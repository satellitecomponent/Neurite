const fs = require('fs');
const path = require('path');

const version = process.argv[2];

if (!version) {
  console.error('❌ Usage: npm run set-version <version>');
  process.exit(1);
}

const versionFilePath = path.join(__dirname, '../modules/build-version.json');

const data = {
  version: version
};

try {
  fs.writeFileSync(versionFilePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`✔ Embedded version file written to: ${versionFilePath}`);
  console.log(`→ Version set to: ${version}`);
} catch (err) {
  console.error('❌ Failed to write version file:', err);
  process.exit(1);
}
