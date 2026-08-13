import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  classifyDegradation,
  isCapabilityDegraded,
  reportDegraded,
  resetDegradedReports,
  subscribeCapabilityDegraded,
} from '../report-degraded'

// `classifyDegradation` checks `navigator.gpu` first, so a navigator that
// *has* gpu is the baseline for exercising the message-matching branches.
const originalNavigator = globalThis.navigator

/** Typed so `.mock.calls[0][0]` is the url rather than an empty tuple. */
function beaconMock() {
  return vi.fn((_url: string, _data?: BodyInit | null) => true)
}

function stubNavigator(value: unknown) {
  Object.defineProperty(globalThis, 'navigator', {
    value,
    configurable: true,
    writable: true,
  })
}

beforeEach(() => {
  resetDegradedReports()
  stubNavigator({ gpu: {}, sendBeacon: beaconMock() })
})

afterEach(() => {
  stubNavigator(originalNavigator)
})

describe('classifyDegradation', () => {
  it('reports missing WebGPU when the navigator has no gpu', () => {
    stubNavigator({})
    expect(classifyDegradation(new Error('anything'))).toBe('webgpu_unavailable')
  })

  it('maps adapter and gpu errors to webgpu_unavailable', () => {
    expect(classifyDegradation(new Error('Failed to get GPU adapter'))).toBe(
      'webgpu_unavailable'
    )
  })

  it('maps model load errors', () => {
    expect(classifyDegradation(new Error('failed to load onnx model'))).toBe(
      'model_load_failed'
    )
  })

  it('maps render errors', () => {
    expect(classifyDegradation(new Error('pdf page render failed'))).toBe(
      'render_failed'
    )
  })

  it('falls back to unknown', () => {
    expect(classifyDegradation(new Error('something else entirely'))).toBe('unknown')
  })

  it('handles non-Error throws', () => {
    expect(classifyDegradation('unsupported mime')).toBe('unsupported_input')
    expect(classifyDegradation(null)).toBe('unknown')
  })
})

describe('reportDegraded', () => {
  it('sends a beacon on first report', () => {
    const sendBeacon = beaconMock()
    stubNavigator({ gpu: {}, sendBeacon })

    expect(reportDegraded('thumbnail_stage3', 'render_failed')).toBe(true)
    expect(sendBeacon).toHaveBeenCalledTimes(1)
    expect(sendBeacon.mock.calls[0][0]).toBe('/api/metrics')
  })

  it('deduplicates repeats of the same stage and reason', () => {
    const sendBeacon = beaconMock()
    stubNavigator({ gpu: {}, sendBeacon })

    reportDegraded('thumbnail_stage3', 'render_failed')
    const second = reportDegraded('thumbnail_stage3', 'render_failed')

    expect(second).toBe(false)
    expect(sendBeacon).toHaveBeenCalledTimes(1)
  })

  it('still reports a different reason for the same stage', () => {
    const sendBeacon = beaconMock()
    stubNavigator({ gpu: {}, sendBeacon })

    reportDegraded('thumbnail_stage3', 'render_failed')
    reportDegraded('thumbnail_stage3', 'unknown')

    expect(sendBeacon).toHaveBeenCalledTimes(2)
  })

  it('never throws when sendBeacon does', () => {
    stubNavigator({
      gpu: {},
      sendBeacon: () => {
        throw new Error('beacon blocked')
      },
    })
    expect(() => reportDegraded('thumbnail_stage1', 'unknown')).not.toThrow()
  })
})

describe('capability degradation', () => {
  it('stays false for a per-file failure', () => {
    reportDegraded('thumbnail_stage3', 'render_failed')
    expect(isCapabilityDegraded()).toBe(false)
  })

  it('flips on a capability-level reason and notifies subscribers', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeCapabilityDegraded(listener)

    reportDegraded('thumbnail_stage3', 'webgpu_unavailable')

    expect(isCapabilityDegraded()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('notifies only on the transition, not on every later report', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeCapabilityDegraded(listener)

    reportDegraded('thumbnail_stage3', 'webgpu_unavailable')
    reportDegraded('metadata_pipeline', 'model_load_failed')

    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn()
    subscribeCapabilityDegraded(listener)()

    reportDegraded('embedding', 'webgpu_unavailable')

    expect(listener).not.toHaveBeenCalled()
  })
})
