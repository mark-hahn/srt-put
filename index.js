const fs       = require('fs');
const path     = require('path');
const unzipper = require('unzipper');

const scanAndUnzip = async () => {
  const currentDir = process.cwd();
  const srtDir = path.join(currentDir, 'srt');

  // Create the "srt" directory if it doesn't exist
  if (!fs.existsSync(srtDir)) {
    fs.mkdirSync(srtDir);
  }

  // Scan the current directory for zip files
  const files = fs.readdirSync(currentDir);
  const zipFiles = files.filter(file => path.extname(file) === '.zip');

  // Unzip each zip file with .srt suffix to the "srt" directory
  for (const zipFile of zipFiles) {
    const zipFilePath = path.join(currentDir, zipFile);
    const extractedFiles = await fs.createReadStream(zipFilePath)
      .pipe(unzipper.Parse())
      .on('entry', entry => {
        const fileName = entry.path;
        const fileExtension = path.extname(fileName);
        if (fileExtension === '.srt') {
          entry.pipe(fs.createWriteStream(path.join(srtDir, fileName)));
        } else {
          entry.autodrain();
        }
      })
      .promise();
    console.log(`Unzipped ${zipFile} to ${srtDir}`);
  }
};

const deleteZipFiles = () => {
  const currentDir = process.cwd();

  // Scan the current directory for zip files
  const files = fs.readdirSync(currentDir);
  const zipFiles = files.filter(file => path.extname(file) === '.zip');

  // Delete each zip file
  for (const zipFile of zipFiles) {
    const zipFilePath = path.join(currentDir, zipFile);
    fs.unlinkSync(zipFilePath);
    console.log(`Deleted ${zipFile}`);
  }
};

const seasonEpisode = (fileName) => {
  let match = fileName.match( /S(\d+)E(\d+)/i);
  if (match) {
    const season  = parseInt(match[1]);
    const episode = parseInt(match[2]);
    return { season, episode };
  }
  match = fileName.match( /\D(\d+)x(\d+)\D/i);
  if (match) {
    const season  = parseInt(match[1]);
    const episode = parseInt(match[2]);
    return { season, episode };
  }
  console.log(`seasonEpisode: cannot parse ${fileName}`);
  return null;
};

const dump = () => {
  const currentDir = process.cwd();

  // Scan the current directory for srt files
  const files = fs.readdirSync(currentDir)
                  .filter(file => path.extname(file) === '.srt');

  for (const fileName of files) {
    const se = seasonEpisode(fileName);
    if(se == null) continue;
    const {season, episode} = se;
    console.log(`${fileName}: S${season}E${episode}`);
  }
};

// scanAndUnzip().catch(console.error);
// deleteZipFiles();

dump();
