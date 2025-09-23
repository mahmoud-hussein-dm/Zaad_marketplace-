function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req
      .on('data', (chunk) => chunks.push(chunk))
      .on('end', () => {
        if (!chunks.length) {
          resolve(null);
          return;
        }
        const raw = Buffer.concat(chunks).toString();
        try {
          const parsed = JSON.parse(raw);
          resolve(parsed);
        } catch (error) {
          reject(new Error('invalid-json'));
        }
      })
      .on('error', reject);
  });
}

module.exports = {
  parseBody
};
