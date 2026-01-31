import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Test endpoint to verify iCloud authentication
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const email = process.env.ICLOUD_EMAIL;
    const password = process.env.ICLOUD_PASSWORD;

    if (!email || !password) {
        return res.status(500).json({ error: 'Missing credentials' });
    }

    const authHeader = 'Basic ' + Buffer.from(`${email}:${password}`).toString('base64');

    try {
        // Test 1: Simple PROPFIND to root
        const response1 = await fetch('https://caldav.icloud.com/', {
            method: 'PROPFIND',
            headers: {
                'Authorization': authHeader,
                'Depth': '0'
            }
        });

        // Test 2: With proper XML body
        const propfindBody = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:current-user-principal />
  </d:prop>
</d:propfind>`;

        const response2 = await fetch('https://caldav.icloud.com/', {
            method: 'PROPFIND',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/xml; charset=utf-8',
                'Depth': '0'
            },
            body: propfindBody
        });

        const text2 = await response2.text();

        res.status(200).json({
            email: email.substring(0, 3) + '***',
            passwordLength: password.length,
            test1: {
                status: response1.status,
                statusText: response1.statusText
            },
            test2: {
                status: response2.status,
                statusText: response2.statusText,
                responsePreview: text2.substring(0, 500)
            }
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
