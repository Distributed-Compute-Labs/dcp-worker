#! /usr/bin/env bash
#
# @file         generate-docs.sh
# @athor        Brandon Christie <brandon@distributive.network>
# @date         Mar 2023
#
# @description  Publishes the docs for each component
#               to backstage.

# "Strict mode"
set -euo pipefail

SCRIPT_DIR=$(dirname "$0")
echo "Script Directory: $SCRIPT_DIR"

# cd to the directory of the script allowing it to be called from any path.
cd "$SCRIPT_DIR" || exit

# Save the directory of the script allowing absolute paths to be used for safety concerns.
ROOT_DIR=$(pwd)
echo "Current Directory: $ROOT_DIR"

TECHDOCS_S3_BUCKET_NAME='backstage.distributive.network'
echo "TechDocs Bucket Name: $TECHDOCS_S3_BUCKET_NAME"

ENTITY_NAMESPACE='default'
echo "Namespace: $ENTITY_NAMESPACE"

ENTITY_KIND=$(cat catalog-info.yaml | yq ".kind")
echo "Kind: $ENTITY_KIND"

ENTITY_NAME=$(cat catalog-info.yaml | yq ".metadata.name")
echo "Name: $ENTITY_NAME"

TECHDOCS_REF="$(cat catalog-info.yaml | yq ".metadata.annotations.\"backstage.io/techdocs-ref\"")"
echo "TechDocs Ref: $TECHDOCS_REF"

# An example of the the techdocs-ref in the YAML file:
# dir:./docs/dcp
#
# The Regex below will isolate the directory path giving the
# result 'docs/dcp' for the given example.
if [[ "$TECHDOCS_REF" =~ dir:./([a-zA-Z0-9/._-]+) ]]; then
  RELATIVE_DOCS_DIR="${BASH_REMATCH[1]}"
  echo "Relative Docs Directory: $RELATIVE_DOCS_DIR"
  DOCS_DIR="$ROOT_DIR/$RELATIVE_DOCS_DIR"
fi

echo "Docs Directory: $DOCS_DIR"
# The techdocs-cli commands below must be called in the directory where the mkdocs.yml
# file is present.
cd "$DOCS_DIR" || exit
echo "Current Directory: $(pwd)"

# MkDocs requires an index.md or README.md file, if one does not exist it will
# be generated automatically.
if ! [ "$(find . -name index.md)" ] && ! [ "$(find . -name README.md)" ]; then
  echo "README.md or index.md was not found and will be automatically generated."
  echo "> **Warning**: MkDocs requires a top level index.md or README.md (case sensitive)" \
        "This index.md file has been generated automatically to ensure MkDocs works correctly" \
        > index.md
fi

# Creates the HTML for backstage.
techdocs-cli generate --no-docker --verbose

# If the site directory does not contain an 'index.html' file, then exit
# as the publish will fail.
if ! [ "$(find . -name index.html | head -1)" ]; then
  echo "Site directory does not contain an 'index.html' file."
  exit
fi

techdocs-cli publish --publisher-type awsS3 --storage-name "$TECHDOCS_S3_BUCKET_NAME" \
              --entity "$ENTITY_NAMESPACE"/"$ENTITY_KIND"/"$ENTITY_NAME" --directory ./site/

# Clean up the site directory after the component has been published.
if ! [ "$CI" ]; then
  rm -r "$ROOT_DIR/site/"
fi

echo "View generated component: https://backstage.overwatch.distributive.network/docs/default/component/$ENTITY_NAME"
