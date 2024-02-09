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
  for (const zipFile of zipFiles) {
    const zipFilePath = path.join(currentDir, zipFile);
    fs.unlinkSync(zipFilePath);
    // console.log(`Deleted ${zipFile}`);
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
        videoFiles.push([season, episode, noExt]);
      }
    }
  }
};

const getSeaEpiStr = (season, episode) => {
  const seaStr = season.toString().padStart(2, '0');
  const epiStr = episode.toString().padStart(2, '0');
  return `S${seaStr}E${epiStr}`;
}

const copySrtFile = (srtFile, videoFile) => {
  const srtFileForVideoFile = videoFile + '.English.srt';
  // console.log(
  //   `Copying ${srtFile} to\n ${srtFileForVideoFile}`);
  fs.copyFileSync(srtFile, srtFileForVideoFile);
}

function deleteDirectoryRecursive(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.readdirSync(dirPath).forEach(function(file, index){
      const curPath = path.join(dirPath, file);
      if (fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteDirectoryRecursive(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(dirPath);
  }
}


/////////////////  MAIN  ///////////////////////
(async () => {
  await scanAndUnzip().catch(console.error);

  deleteZipFiles();

  const videoFiles = [];
  findVideoFiles(currentDir, videoFiles);
  const vidfilesBySeaEpi = {};
  for (const videoFile of videoFiles) {
    const season  = videoFile[0];
    const episode = videoFile[1];
    const key     = season + 'x' + episode;
    vidfilesBySeaEpi[key] = videoFile;
  }
  // console.log(vidfilesBySeaEpi);

  const srtFileNames = fs.readdirSync(srtDir).filter(file =>
        path.extname(file).toLowerCase() === '.srt');
  const srtFiles = [];
  for (const fileName of srtFileNames) {
    const se = seasonEpisode(fileName);
    if(se == null) continue;
    const {season, episode} = se;
    const nameWithDir = path.join(srtDir, fileName);
    srtFiles.push([season, episode, nameWithDir]);
  }

  srtFiles.sort((a, b) => {
    if (a[0] !== b[0]) return a[0] - b[0];
    return a[1] - b[1];
  });
  // console.log(srtFiles);

  const srtfilesBySeaEpi = {};
  srtFilesLoop:
  for (const srtFile of srtFiles) {
    const season  = srtFile[0];
    const episode = srtFile[1];
    const key     = season + 'x' + episode;
    if(!vidfilesBySeaEpi.hasOwnProperty(key)) {
      console.log(`No video file ${key}`);
      if(episode === 0) {
        for(let i = 1; ; i++) {
          const key = season + 'x' + i;
          if(!vidfilesBySeaEpi.hasOwnProperty(key)) {
            const keyLast = season + 'x' + (i-1);
            console.log('  ' + srtFile[2], '  -> \n',
                        ' ' + vidfilesBySeaEpi[keyLast][2]);
            srtfilesBySeaEpi[keyLast] = srtFile;
            continue srtFilesLoop;
          }
        }
      }
      continue srtFilesLoop;
    }
    srtfilesBySeaEpi[key] = srtFile;
  }
  // console.log(srtfilesBySeaEpi);

  for(let videoFile of videoFiles) {
    const [season, episode] = videoFile;
    const key = `${season}x${episode}`;
    const srtFile = srtfilesBySeaEpi[key];
    if(!srtFile) {
      console.log(`No srt file ${key}`);
      continue
    }
    else {
      copySrtFile(srtFile[2], videoFile[2]);
    }
  }

  deleteDirectoryRecursive(srtDir);
})();
