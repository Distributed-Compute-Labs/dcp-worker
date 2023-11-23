#! /usr/bin/env bash
#
# @file         publish-docs.sh
# @athor        Brandon Christie <brandon@distributive.network>
# @date         Aug 2023
#
# @description  Publishes the docs for each component
#               to backstage.

set -euo pipefail

cd "$(dirname "$0")/.."

ROOT_DIR=$PWD

echo "TechDocs Bucket Name: $TECHDOCS_S3_BUCKET_NAME"
echo "Namespace: $ENTITY_NAMESPACE"

ENTITY_KIND=$(yq ".kind" < catalog-info.yaml)
echo "Kind: $ENTITY_KIND"

ENTITY_NAME=$(yq ".metadata.name" < catalog-info.yaml)
echo "Name: $ENTITY_NAME"

TECHDOCS_REF=$(yq ".metadata.annotations.\"backstage.io/techdocs-ref\"" < catalog-info.yaml)
echo "TechDocs Ref: $TECHDOCS_REF"

# An example of the the techdocs-ref in the YAML file:
# dir:./docs/dcp
#
# The Regex below will isolate the directory path giving the
# result 'docs/dcp' for the given example.
if [[ "$TECHDOCS_REF" =~ dir:\.(.*) ]]; then
  RELATIVE_DOCS_DIR="${BASH_REMATCH[1]%%[[:space:]]*}"
  DOCS_DIR="$ROOT_DIR/$RELATIVE_DOCS_DIR"
fi

# The techdocs-cli commands must be called in the directory where the
# mkdocs.yml file is present.
cd "$DOCS_DIR"

# MkDocs requires an index.md or README.md file, if one does not exist it will
# be generated automatically.
if ! [ -f index.md ] && ! [ -f README.md ]; then
  if [ -z "$CI" ]; then  
    AUTHOR="$(git config user.name) <$(git config user.email)>"
  else  
    AUTHOR="$CI_COMMIT_AUTHOR"
  fi  

  echo "README.md or index.md was not found and will be automatically generated."  
  cat >> index.md <<EOF
<!--
@author  $AUTHOR
@date    $(date)
@machine $HOSTNAME
@rev     $(git rev-parse HEAD)
-->
> **Warning**: MkDocs requires a top level index.md or README.md (case sensitive)
This index.md file has been generated automatically to ensure MkDocs works correctly
EOF
fi

npx techdocs-cli generate --no-docker --verbose

npx techdocs-cli publish \
  --publisher-type awsS3 \
  --storage-name "$TECHDOCS_S3_BUCKET_NAME" \
  --entity "$ENTITY_NAMESPACE"/"$ENTITY_KIND"/"$ENTITY_NAME" \
  --directory "$DOCS_DIR"/site

rm -r "$DOCS_DIR"/site

echo "View generated component: https://backstage.overwatch.distributive.network/docs/default/component/$ENTITY_NAME"
