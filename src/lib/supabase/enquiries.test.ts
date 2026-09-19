import { beforeEach, describe, expect, it, vi } from 'vitest'
import { describeEnquiryError, submitEnquiry } from './enquiries'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/supabase', () => ({ supabase: { rpc } }))

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: null, error: null })
})

describe('submitEnquiry', () => {
  it('trims what people typed and leaves out what they left blank', async () => {
    await submitEnquiry({
      organisation: ' Initech ',
      contactName: ' Peter ',
      email: ' peter@initech.test ',
      phone: '  ',
      message: ' Hello ',
      details: { seats: 3 },
      websiteUrl: '',
    })

    expect(rpc).toHaveBeenCalledWith('submit_enquiry', {
      organisation: 'Initech',
      contact_name: 'Peter',
      email: 'peter@initech.test',
      phone: undefined,
      message: 'Hello',
      details: { seats: 3 },
      website_url: undefined,
    })
  })

  it('passes the honeypot on when something is in it', async () => {
    await submitEnquiry({
      organisation: 'Initech',
      contactName: 'Bot',
      email: 'bot@initech.test',
      websiteUrl: 'https://spam.example',
    })

    expect(rpc).toHaveBeenCalledWith(
      'submit_enquiry',
      expect.objectContaining({ website_url: 'https://spam.example', details: undefined }),
    )
  })

  it('throws the database error', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('email address is not valid') })

    await expect(
      submitEnquiry({ organisation: 'Initech', contactName: 'Peter', email: 'nope' }),
    ).rejects.toThrow('email address is not valid')
  })
})

describe('describeEnquiryError', () => {
  it('puts the database’s reasons in the visitor’s terms', () => {
    expect(describeEnquiryError(new Error('too many enquiries from this address'))).toMatch(
      /try again in an hour/,
    )
    expect(describeEnquiryError(new Error('email address is not valid'))).toMatch(
      /does not look right/,
    )
    expect(describeEnquiryError(new Error('network down'))).toBe('network down')
    expect(describeEnquiryError('')).toBe('Could not send your enquiry.')
  })
})
