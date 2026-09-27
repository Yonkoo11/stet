// Tiny status endpoint so the frontend can show the plain-engine banner
// immediately on load, not only after the first decision. Reports a
// boolean-derived label only -- never the key value itself.

export default function handler(req, res) {
  res.status(200).json({ engine: process.env.SERV_API_KEY ? "serv" : "plain" });
}
