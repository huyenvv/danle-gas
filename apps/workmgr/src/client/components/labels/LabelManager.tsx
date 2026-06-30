import { useEffect, useState } from 'react'
import type { Label } from '../../../core/domain/models'
import api from '../../api'

export default function LabelManager() {
  const [labels, setLabels] = useState<Label[]>([])
  const [name, setName] = useState('')
  const [color, setColor] = useState('#1e88e5')
  const [err, setErr] = useState('')

  async function load() {
    try { setLabels(await api.labels.list()) } catch (e) { setErr((e as Error).message) }
  }
  useEffect(() => { load() }, [])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    try { await api.labels.add({ name, color }); setName(''); await load() }
    catch (e) { setErr((e as Error).message) }
  }
  async function remove(id: number) {
    try { await api.labels.remove(id); await load() } catch (e) { setErr((e as Error).message) }
  }

  return (
    <div style={{ maxWidth: 480, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h2>Quản lý Nhãn</h2>
      {err && <p style={{ color: 'red' }}>{err}</p>}
      <form onSubmit={add} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên nhãn" />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <button type="submit">Thêm</button>
      </form>
      <ul>
        {labels.map((l) => (
          <li key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 14, height: 14, background: l.color, display: 'inline-block', borderRadius: 3 }} />
            {l.name}
            <button onClick={() => remove(l.id)} style={{ marginLeft: 'auto' }}>Xóa</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
