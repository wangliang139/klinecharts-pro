import { Component, createMemo, createSignal, Show } from 'solid-js'

import { Modal, Select, SelectDataSourceItem } from '../../component'
import { WarningFrequency, WarningItemInput, WarningType, WarningWindow } from '../../types/types'

export interface WarningAddModalProps {
  onClose: () => void
  onSubmit: (payload: WarningItemInput) => void | Promise<void>
}

type FormState = {
  type: WarningType
  frequency: WarningFrequency
  price: string
  window: WarningWindow
  percent: string
  remark: string
}

const TYPE_OPTIONS: Array<SelectDataSourceItem & { key: WarningType }> = [
  { key: 'price_reach', text: '价格达到' },
  { key: 'price_rise_to', text: '价格上涨至' },
  { key: 'price_fall_to', text: '价格下跌至' },
  { key: 'price_rise_pct_over', text: '价格涨幅超过' },
  { key: 'price_fall_pct_over', text: '价格跌幅超过' },
]

const FREQUENCY_OPTIONS: Array<SelectDataSourceItem & { key: WarningFrequency }> = [
  { key: 'repeat', text: '重复提醒' },
  { key: 'once', text: '仅提醒一次' },
]

const WINDOW_OPTIONS: Array<SelectDataSourceItem & { key: WarningWindow }> = [
  { key: '5m', text: '5分' },
  { key: '1h', text: '1小时' },
  { key: '4h', text: '4小时' },
  { key: '24h', text: '24小时' },
]

const WarningAddModal: Component<WarningAddModalProps> = (props) => {
  const [submitting, setSubmitting] = createSignal(false)
  const [error, setError] = createSignal('')
  const [form, setForm] = createSignal<FormState>({
    type: 'price_reach',
    frequency: 'repeat',
    price: '',
    window: '5m',
    percent: '10',
    remark: '',
  })

  const isPriceType = createMemo(() => {
    const t = form().type
    return t === 'price_reach' || t === 'price_rise_to' || t === 'price_fall_to'
  })

  const submit = async () => {
    if (submitting()) return
    const value = form()
    const payload: WarningItemInput = {
      type: value.type,
      frequency: value.frequency,
      remark: value.remark.trim() || undefined,
    }
    if (isPriceType()) {
      const price = Number(value.price)
      if (!Number.isFinite(price) || price <= 0) {
        setError('请输入大于 0 的价格')
        return
      }
      payload.price = price
    } else {
      const percent = Number(value.percent)
      if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
        setError('百分比需为 1-100 的整数')
        return
      }
      payload.window = value.window
      payload.percent = percent
    }
    setError('')
    setSubmitting(true)
    try {
      await props.onSubmit(payload)
      props.onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="添加预警"
      width={460}
      buttons={[
        { children: '取消', type: 'cancel', onClick: props.onClose },
        { children: submitting() ? '提交中...' : '提交', onClick: submit },
      ]}
      onClose={props.onClose}
    >
      <div class="klinecharts-pro-warning-add-modal">
        <div class="row">
          <span>类型</span>
          <Select
            style={{ width: '220px' }}
            value={TYPE_OPTIONS.find(item => item.key === form().type)?.text}
            dataSource={TYPE_OPTIONS}
            onSelected={item => {
              const next = (item as SelectDataSourceItem).key as WarningType
              setForm(prev => ({ ...prev, type: next }))
            }}
          />
        </div>
        <div class="row">
          <span>频率</span>
          <Select
            style={{ width: '220px' }}
            value={FREQUENCY_OPTIONS.find(item => item.key === form().frequency)?.text}
            dataSource={FREQUENCY_OPTIONS}
            onSelected={item => {
              const next = (item as SelectDataSourceItem).key as WarningFrequency
              setForm(prev => ({ ...prev, frequency: next }))
            }}
          />
        </div>
        <Show when={isPriceType()}>
          <div class="row">
            <span>价格</span>
            <input
              class="field-input"
              type="number"
              min="0"
              step="any"
              value={form().price}
              onInput={(event) => {
                setForm(prev => ({ ...prev, price: (event.target as HTMLInputElement).value }))
              }}
            />
          </div>
        </Show>
        <Show when={!isPriceType()}>
          <>
            <div class="row">
              <span>分钟</span>
              <Select
                style={{ width: '220px' }}
                value={WINDOW_OPTIONS.find(item => item.key === form().window)?.text}
                dataSource={WINDOW_OPTIONS}
                onSelected={item => {
                  const next = (item as SelectDataSourceItem).key as WarningWindow
                  setForm(prev => ({ ...prev, window: next }))
                }}
              />
            </div>
            <div class="row">
              <span>百分比</span>
              <input
                class="field-input"
                type="number"
                min="1"
                max="100"
                step="1"
                value={form().percent}
                onInput={(event) => {
                  setForm(prev => ({ ...prev, percent: (event.target as HTMLInputElement).value }))
                }}
              />
            </div>
          </>
        </Show>
        <div class="row">
          <span>备注</span>
          <input
            class="field-input"
            type="text"
            value={form().remark}
            onInput={(event) => {
              setForm(prev => ({ ...prev, remark: (event.target as HTMLInputElement).value }))
            }}
            placeholder="可选"
          />
        </div>
        <Show when={!!error()}>
          <div class="error-text">{error()}</div>
        </Show>
      </div>
    </Modal>
  )
}

export default WarningAddModal
