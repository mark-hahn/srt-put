const fs       = require('fs');
const path     = require('path');
const unzipper = require('unzipper');

const currentDir = process.cwd();
const parentDir  = path.resolve(currentDir, '..');
const srtDir     = path.join(currentDir, 'srt');

if(parentDir != '/mnt/media/tv') {
  console.log(`Parent should be /mnt/media/tv, found ${parentDir}`);
  return;
}

const scanAndUnzip = async () => {
  if (!fs.existsSync(srtDir)) fs.mkdirSync(srtDir);

  const files = fs.readdirSync(currentDir);
  const zipFiles = files.filter(
          file => path.extname(file) === '.zip');
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
  const zipFiles = files.filter(
          file => path.extname(file) === '.zip');
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


const findVideoFiles = (dir, videoFiles) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory())
      findVideoFiles(filePath, videoFiles);
    else {
      const ext = path.extname(file).toLowerCase();
      // console.log(ext);
      if (ext === '.mp4' || ext === '.mkv' || ext === '.avi') {
        const se = seasonEpisode(file);
        if(se === null) return;
        const {season, episode} = se;
        const noExt = filePath.slice(0, -4);
        videoFiles.push([season, episode, dir, noExt]);
      }
    }
  }
};

/////////////////  MAIN  ///////////////////////
(async () => {
  await scanAndUnzip().catch(console.error);

  // deleteZipFiles();
  
  const srtFiles = fs.readdirSync(srtDir).filter(file =>
        path.extname(file).toLowerCase() === '.srt');
  const fileArr = [];
  for (const fileName of srtFiles) {
    const se = seasonEpisode(fileName);
    if(se == null) continue;
    const {season, episode} = se;
    fileArr.push([season, episode, fileName]);
  }

  fileArr.sort((a, b) => {
    if (a[0] !== b[0]) return a[0] - b[0];
    return a[1] - b[1];
  });
  
  const videoFiles = [];
  findVideoFiles(currentDir, videoFiles);

  videoFiles.sort((a, b) => {
    if (a[0] !== b[0]) return a[0] - b[0];
    return a[1] - b[1];
  });
  
  console.log(videoFiles);


  // let count = 0;
  // for (const arr of fileArr) {
  //   const [season, episode] = arr;
  //   const countStr = (++count).toString().padStart(2, '0');
  //   const seaStr   = season   .toString().padStart(2, '0');
  //   const epiStr   = episode  .toString().padStart(2, '0');
  //   console.log(
  //     `processing ${countStr}/${fileArr.length}: S${seaStr}E${epiStr}`);
  // }
})();

