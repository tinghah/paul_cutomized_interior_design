import fs from 'fs';
import path from 'path';
import https from 'https';

const download = (url: string, dest: string) => {
  return new Promise<void>((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return download(response.headers.location as string, dest).then(resolve).catch(reject);
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

async function main() {
  const dirs = ['public/spaces/space1', 'public/spaces/space2', 'public/materials'];
  for (const dir of dirs) {
    fs.mkdirSync(path.join(process.cwd(), dir), { recursive: true });
  }

  const files = [
    { url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&q=80', dest: 'public/spaces/space1/living.jpg' },
    { url: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=800&q=80', dest: 'public/spaces/space1/bedroom.jpg' },
    { url: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&q=80', dest: 'public/spaces/space1/kitchen.jpg' },
    { url: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=800&q=80', dest: 'public/spaces/space2/living.jpg' },
    { url: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=800&q=80', dest: 'public/spaces/space2/bedroom.jpg' },
    { url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&q=80', dest: 'public/spaces/space2/bathroom.jpg' },
    { url: 'https://images.unsplash.com/photo-1515266591878-f93e32bc5937?w=400&q=80', dest: 'public/materials/tile.jpg' },
    { url: 'https://images.unsplash.com/photo-1615800098779-1be32e60cca3?w=400&q=80', dest: 'public/materials/wallpaper.jpg' },
    { url: 'https://images.unsplash.com/photo-1516455590571-18256e5bb9ff?w=400&q=80', dest: 'public/materials/wood.jpg' },
    { url: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=400&q=80', dest: 'public/materials/concrete.jpg' },
  ];

  for (const file of files) {
    console.log(`Downloading ${file.dest}...`);
    await download(file.url, path.join(process.cwd(), file.dest));
  }
  console.log('Done!');
}

main().catch(console.error);
