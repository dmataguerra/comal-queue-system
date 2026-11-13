import xmlrpc from 'xmlrpc';
export function testlink(url, key) {
  const client = xmlrpc.createClient({ url });
  return (method, args = {}) =>
    new Promise((resolve, reject) => {
      if (method === 'uploadExecutionAttachment') {
        const esc = (v) =>
          String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
        const members = Object.entries({ devKey: key, ...args })
          .map(([name, value]) => {
            const encodedValue = Buffer.isBuffer(value)
              ? value
                  .toString('base64')
                  .match(/.{1,76}/g)
                  .join('\n')
              : value;
            const encoded = `<string>${esc(encodedValue)}</string>`;
            return `<member><name>${esc(name)}</name><value>${encoded}</value></member>`;
          })
          .join('');
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/xml' },
          body: `<?xml version="1.0"?><methodCall><methodName>tl.${method}</methodName><params><param><value><struct>${members}</struct></value></param></params></methodCall>`,
          signal: AbortSignal.timeout(30000),
        })
          .then(async (response) => {
            const body = await response.text();
            if (
              !response.ok ||
              body.includes('<fault>') ||
              /<member><name>code<\/name><value><int>(?!0)\d+<\/int>/.test(body)
            )
              throw new Error(`Attachment API error: ${body.slice(0, 1000)}`);
            resolve({ accepted: true, responseXml: body });
          })
          .catch(reject);
        return;
      }
      const timer = setTimeout(() => reject(new Error(`TestLink API timeout: ${method}`)), 30000);
      timer.unref();
      client.methodCall(`tl.${method}`, [{ devKey: key, ...args }], (error, result) => {
        clearTimeout(timer);
        if (error) return reject(error);
        const errors = (Array.isArray(result) ? result : [result]).filter(
          (v) => v?.code && v?.message,
        );
        if (errors.length) return reject(new Error(JSON.stringify(errors)));
        resolve(result);
      });
    });
}
