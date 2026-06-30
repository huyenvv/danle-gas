// Ráp `api` từ contracts + transport đã chọn theo môi trường.
import { gasTransport } from './transport/gas-transport'
import { httpTransport } from './transport/http-transport'
import { makeLabels, LabelsApi } from './contracts/labels'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isGas = typeof (globalThis as any).google !== 'undefined' &&
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  typeof (globalThis as any).google?.script?.run !== 'undefined'

const transport = isGas ? gasTransport : httpTransport
const call = (method: string, args: unknown[]) => transport(method, args)

export interface Api {
  labels: LabelsApi
}

export const api: Api = {
  labels: makeLabels(call),
}

export default api
