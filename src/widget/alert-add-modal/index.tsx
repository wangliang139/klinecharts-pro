import { Component, createMemo, createSignal, Show } from 'solid-js'

import { Modal, Select, SelectDataSourceItem } from '../../component'
import i18n from '../../i18n'
import { getAlertFrequencyText, getAlertTypeText, getAlertWindowText } from '../../i18n/trading'
import { AlertFrequency, AlertItemInput, AlertType, AlertWindow } from '../../types/types'

export interface AlertAddModalProps {
  locale: string
  onClose: () => void
  onSubmit: (payload: AlertItemInput) => boolean | Promise<boolean>
}

type FormState = {
  type: AlertType
  frequency: AlertFrequency
  price: string
  window: AlertWindow
  percent: string
  remark: string
}

const AlertAddModal: Component<AlertAddModalProps> = (props) => {
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

  const typeOptions = createMemo<Array<SelectDataSourceItem & { key: AlertType }>>(() => [
    { key: 'price_reach', text: getAlertTypeText('price_reach', props.locale) },
    { key: 'price_rise_to', text: getAlertTypeText('price_rise_to', props.locale) },
    { key: 'price_fall_to', text: getAlertTypeText('price_fall_to', props.locale) },
    { key: 'price_rise_pct_over', text: getAlertTypeText('price_rise_pct_over', props.locale) },
    { key: 'price_fall_pct_over', text: getAlertTypeText('price_fall_pct_over', props.locale) },
  ])

  const frequencyOptions = createMemo<Array<SelectDataSourceItem & { key: AlertFrequency }>>(() => [
    { key: 'repeat', text: getAlertFrequencyText('repeat', props.locale) },
    { key: 'once', text: getAlertFrequencyText('once', props.locale) },
  ])

  const windowOptions = createMemo<Array<SelectDataSourceItem & { key: AlertWindow }>>(() => [
    { key: '5m', text: getAlertWindowText('5m', props.locale) },
    { key: '1h', text: getAlertWindowText('1h', props.locale) },
    { key: '4h', text: getAlertWindowText('4h', props.locale) },
    { key: '24h', text: getAlertWindowText('24h', props.locale) },
  ])

  const submit = async () => {
    if (submitting()) return
    const value = form()
    const payload: AlertItemInput = {
      type: value.type,
      frequency: value.frequency,
      remark: value.remark.trim() || undefined,
    }
    if (isPriceType()) {
      const price = Number(value.price)
      if (!Number.isFinite(price) || price <= 0) {
        setError(i18n('alert_validation_price_gt_zero', props.locale))
        return
      }
      payload.price = price
    } else {
      const percent = Number(value.percent)
      if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
        setError(i18n('alert_validation_percent_range', props.locale))
        return
      }
      payload.window = value.window
      payload.percent = percent
    }
    setError('')
    setSubmitting(true)
    try {
      const canClose = await props.onSubmit(payload)
      if (canClose) {
        props.onClose()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={i18n('alert_add', props.locale)}
      width={360}
      buttons={[
        { children: i18n('cancel', props.locale), type: 'cancel', onClick: props.onClose },
        { children: submitting() ? i18n('alert_submitting', props.locale) : i18n('alert_submit', props.locale), onClick: submit },
      ]}
      onClose={props.onClose}
    >
      <div class="klinecharts-pro-alert-add-modal">
        <div class="row">
          <span>{i18n('alert_field_type', props.locale)}</span>
          <Select
            style={{ width: '220px' }}
            value={typeOptions().find(item => item.key === form().type)?.text}
            dataSource={typeOptions()}
            onSelected={item => {
              const next = (item as SelectDataSourceItem).key as AlertType
              setForm(prev => ({ ...prev, type: next }))
            }}
          />
        </div>
        <Show when={isPriceType()}>
          <div class="row">
            <span>{i18n('alert_field_price', props.locale)}</span>
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
              <span>{i18n('alert_field_window', props.locale)}</span>
              <Select
                style={{ width: '220px' }}
                value={windowOptions().find(item => item.key === form().window)?.text}
                dataSource={windowOptions()}
                onSelected={item => {
                  const next = (item as SelectDataSourceItem).key as AlertWindow
                  setForm(prev => ({ ...prev, window: next }))
                }}
              />
            </div>
            <div class="row">
              <span>{i18n('alert_field_percent', props.locale)}</span>
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
          <span>{i18n('alert_field_frequency', props.locale)}</span>
          <Select
            style={{ width: '220px' }}
            value={frequencyOptions().find(item => item.key === form().frequency)?.text}
            dataSource={frequencyOptions()}
            onSelected={item => {
              const next = (item as SelectDataSourceItem).key as AlertFrequency
              setForm(prev => ({ ...prev, frequency: next }))
            }}
          />
        </div>
        <div class="row">
          <span>{i18n('alert_field_remark', props.locale)}</span>
          <input
            class="field-input"
            type="text"
            value={form().remark}
            onInput={(event) => {
              setForm(prev => ({ ...prev, remark: (event.target as HTMLInputElement).value }))
            }}
            placeholder={i18n('alert_optional', props.locale)}
          />
        </div>
        <Show when={!!error()}>
          <div class="error-text">{error()}</div>
        </Show>
      </div>
    </Modal>
  )
}

export default AlertAddModal
