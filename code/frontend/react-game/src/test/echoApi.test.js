import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { getServerStatus } from '../api/echoApi'

vi.mock('axios')

describe('echoApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getServerStatus', () => {
    it('throws error if url is not a string', async () => {
      await expect(getServerStatus(null)).rejects.toThrow('Invalid server URL')
      await expect(getServerStatus(123)).rejects.toThrow('Invalid server URL')
    })

    it('throws error if url is empty string', async () => {
      await expect(getServerStatus('')).rejects.toThrow('Invalid server URL')
      await expect(getServerStatus('   ')).rejects.toThrow('Invalid server URL')
    })

    it('throws error for unsupported protocol', async () => {
      await expect(getServerStatus('ftp://example.com')).rejects.toThrow('Unsupported protocol')
    })

    it('returns data from axios call', async () => {
      const mockData = { status: 'ok' }
      axios.get.mockResolvedValueOnce({ data: mockData })

      const result = await getServerStatus('https://example.com/some-path?q=1#hash')
      
      expect(axios.get).toHaveBeenCalledWith('https://example.com/api/echo/status', { timeout: 3000 })
      expect(result).toEqual(mockData)
    })

    it('handles http protocol', async () => {
        const mockData = { status: 'ok' }
        axios.get.mockResolvedValueOnce({ data: mockData })
  
        const result = await getServerStatus('http://example.com')
        
        expect(axios.get).toHaveBeenCalledWith('http://example.com/api/echo/status', { timeout: 3000 })
        expect(result).toEqual(mockData)
      })
  })
})
