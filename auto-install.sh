check redirs for ks creation
check right packages in package.json

#! /bin/bash -e
#
# @file         auto-install.sh
#               Shell script to install the DCP Worker on internal
#               Debian (Ubuntu) systems w/screensaver management.
# @author       Wes Garland, wes@distributive.network
# @date         Sep 2022
#

echo
echo '*** Installing DCP Worker for Debian systems'
echo '*** Do not share outside of ⊇istributive!'
echo
sleep 2
tmpdir=`mktemp -d`
trap "echo '*** Failure!!! - installation incomplete'; rm -rf \"$tmpdir\"" EXIT 2
echo "Temp dir is $tmpdir"

# /etc/dcp/dcp-worker/config.json
# /etc/dcp/dcp-worker/id.keystore
# /etc/dcp/dcp-worker/bank-account.keystore
# ~/.dcp/dcp-client/dcp-worker/dcp-config.js

cd "$tmpdir" || exit 2
user groupadd dcp-worker || true
sudo adduser -g dcp-worker dcp-worker || true
mkdir -p -m 750 ~dcp-worker ~dcp-worker/.dcp-worker
chown dcp-worker:dcp-worker ~dcp-worker ~dcp-worker/.dcp
sudo apt remove dcp-evaluator-v8 || true
sudo npm uninstall -g @dcp-test/dcp-worker dcp-worker
wget https://people.kingsds.network/wesgarland/apt-repo/pool/main/dcp-evaluator-v8_1.0.0.0_amd64.deb
sudo apt install ./dcp-evaluator-v8_1.0.0.0_amd64.deb
sudo npm i -g @dcp-test/dcp-worker@latest --production
sudo npm i -g dbus-next@^0.10.2 --unsafe --production
sudo npm i -g node-pty@^0.10.1 --unsafe --production

if [ ! -d /etc/dcp ]; then
  mkdir -p -m 750 /etc/dcp
  chown root:dcp-worker /etc/dcp
fi

if [ ! -d /etc/dcp/dcp-worker ]; then
  mkdir -p -m 750 /etc/dcp
  chown root:dcp-worker /etc/dcp/dcp-worker
fi

[ -f /etc/dcp/dcp-worker/id.keystore ]           || ln -s ~dcp-worker/.dcp/id.keystore           /etc/dcp/dcp-worker
[ -f /etc/dcp/dcp-worker/bank-account.keystore ] || ln -s ~dcp-worker/.dcp/bank-account.keystore /etc/dcp/dcp-worker

[ -d ] /etc/dcp || mkdir -p -m75
if [ ! -d /etc/dcp ]; then
  [ ! -h /etc/dcp ] || sudo rm /etc/dcp
  sudo ln -s ~dcp-worker/.dcp /etc/dcp
fi

node -e "require('/usr/lib/node_modules/dcp-client'); new (require('dcp/wallet').IdKeystore)(null, '').then(x => console.log(JSON.stringify(x)))"
echo "Creating Bank Account Keystore. Upload this keystore to your portal account"
echo "in order to access your funds. Choose a secure passphrase; anyone who has"
echo "this keystore and knows its passphrase can access this bank account forever."
node -e "require('/usr/lib/node_modules/dcp-client'); new (require('dcp/wallet').BankAccountKeystore)().then(x => console.log(JSON.stringify(x)))"

echo
rm -rf "$tmpdir"
trap 'echo "*** Success"' EXIT
