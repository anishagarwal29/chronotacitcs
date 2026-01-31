import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Diagnostic endpoint to discover the correct iCloud calendar URL
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const email = process.env.ICLOUD_EMAIL;
    const password = process.env.ICLOUD_PASSWORD;

    if (!email || !password) {
        return res.status(500).json({ error: 'Missing credentials' });
    }

    const authHeader = 'Basic ' + Buffer.from(`${email}:${password}`).toString('base64');
    const username = email.split('@')[0];

    // Try different URL patterns
    const urlsToTry = [
        `https://caldav.icloud.com/`,
        `https://caldav.icloud.com/${username}/`,
        `https://caldav.icloud.com/${username}/calendars/`,
        `https://caldav.icloud.com/${username}/calendars/home/`,
    ];

    const results = [];

    for (const url of urlsToTry) {
        try {
            const response = await fetch(url, {
                method: 'PROPFIND',
                headers: {
                    'Authorization': authHeader,
                    'Depth': '0'
                }
            });

            results.push({
                url,
                status: response.status,
                statusText: response.statusText,
                success: response.ok
            });
        } catch (error: any) {
            results.push({
                url,
                error: error.message
            });
        }
    }

    res.status(200).json({
        email: email.substring(0, 3) + '***',
        username,
        results
    });
}
