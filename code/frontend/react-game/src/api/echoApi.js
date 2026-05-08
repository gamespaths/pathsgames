import axios from 'axios'

export async function getServerStatus(url) {
  const res = await axios.get(`${url}/api/echo/status`, { timeout: 3000 })
  return res.data
}
