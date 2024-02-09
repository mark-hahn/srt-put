const fs       = require('fs');
const path     = require('path');
const unzipper = require('unzipper');

const currentDir = process.cwd();
const srtDir     = path.join(currentDir, 'srt');

const scanAndUnzip = async () => {
  const files = fs.readdirSync(currentDir);
  const zipFiles = files.filter(file => path.extname(file) === '.zip');
  if(zipFiles.length === 0) {
    console.log('No zip files found');
    return null;
  }
  if (!fs.existsSync(srtDir)) fs.mkdirSync(srtDir);

  // Unzip each zip file with .srt suffix to the "srt" directory
  for (const zipFile of zipFiles) {
    const zipFilePath = path.join(currentDir, zipFile);
    await fs.createReadStream(zipFilePath)
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
  }
  console.log(`Unzipped ${zipFiles.length} files`);
  return zipFiles.length;
};

const deleteZipFiles = () => {
  const files    = fs.readdirSync(currentDir);
  const zipFiles = files.filter(file => path.extname(file) === '.zip');
  // Delete every zip file
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

/////////////////  MAIN  ///////////////////////
(async () => {
  const fileCount = await scanAndUnzip().catch(console.error);

  // deleteZipFiles();

  // process.chdir(srtDir);
  // console.log(`Changed to ${srtDir}`);

  const files = fs.readdirSync(srtDir)
                  .filter(file => path.extname(file) === '.srt');
  const fileArr =[];
  for (const fileName of files) {
    const se = seasonEpisode(fileName);
    if(se == null) continue;
    const {season, episode} = se;
    fileArr.push([season, episode, fileName]);
  }

  fileArr.sort((a, b) => {
    if (a[0] !== b[0]) return a[0] - b[0];
    return a[1] - b[1];
  });

  let count = 0;
  for (const arr of fileArr) {
    const [season, episode] = arr;
    const countStr = (++count).toString().padStart(2, '0');
    const seaStr   = season   .toString().padStart(2, '0');
    const epiStr   = episode  .toString().padStart(2, '0');
    console.log(
      `processing ${countStr}/${fileArr.length}: S${seaStr}E${epiStr}`);
  }
})();

