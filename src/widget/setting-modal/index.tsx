/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { DeepPartial, Styles, utils } from 'klinecharts'
import { Component, createEffect, createSignal, For, Show } from 'solid-js'

import lodashSet from 'lodash/set'

import type { SelectDataSourceItem } from '../../component'
import { Color, Modal, Select, Switch } from '../../component'

import i18n from '../../i18n'
import { ChartObjType } from '../../types'
import { getOptions } from './data'
// import { chartsession, chartsessionCtr } from '../../ChartProComponent'
import { setChartModified } from '../../store/chartStore'
import { loadTradingConfigFromStorage, setTradingConfigState } from '../../store/tradingStore'

export interface SettingModalProps {
  locale: string
  currentStyles: Styles
  onClose: () => void
  onChange: (style: DeepPartial<Styles>) => void
  onRestoreDefault: (options: SelectDataSourceItem[]) => void
}

const SettingModal: Component<SettingModalProps> = props => {
  const [styles, setStyles] = createSignal(props.currentStyles)
  const [options, setOptions] = createSignal(getOptions(props.locale))
  const [currentSetting, setCurrentSetting] = createSignal('trading')
  const [tradingUi, setTradingUi] = createSignal(loadTradingConfigFromStorage())

  let stylee: DeepPartial<Styles> = {}

  createEffect(() => {
    setOptions(getOptions(props.locale))
  })

  createEffect(() => {
    if (currentSetting() === 'trading') {
      setTradingUi(loadTradingConfigFromStorage())
    }
  })

  const update = (option: SelectDataSourceItem, newValue: any) => {
    const chartStateObj = localStorage.getItem(`chartstatedata`)
    let chartObj: ChartObjType
    if (chartStateObj) {
      chartObj = (JSON.parse(chartStateObj) as ChartObjType)
      chartObj.styleObj = chartObj.styleObj ?? {}
    } else {
      chartObj = {
        styleObj: {}
      }
    }
    
    // console.info('update setting', option.key, newValue)
    const i = option.key.indexOf('.');
    const key = i === -1 ? option.key : option.key.slice(0, i) + '.bla' + option.key.slice(i);
    lodashSet(chartObj.styleObj!, option.key, newValue)
    localStorage.setItem(`chartstatedata`, JSON.stringify(chartObj))
    setChartModified(true)
    const style = {}
    lodashSet(style, option.key, newValue)
    lodashSet(style, option.key, newValue)
    const ss = utils.clone(styles())
    lodashSet(ss, option.key, newValue)
    setStyles(ss)
    setOptions(options().map(op => ({ ...op })))
    props.onChange(style)
  }

  const restoreDefault = () => {
    const chartStateObj = localStorage.getItem(`chartstatedata`)
    let chartObj: ChartObjType
    if (chartStateObj) {
      chartObj = (JSON.parse(chartStateObj) as ChartObjType)
      if (chartObj.styleObj)
        chartObj.styleObj = {}
      
      localStorage.setItem(`chartstatedata`, JSON.stringify(chartObj))
    }
    props.onRestoreDefault(options())
    props.onClose()
  }

  const settingsButton = [
    { text: i18n('setting_sidebar_trading', props.locale), key: 'trading' },
    { text: 'Candle', key: 'candle' },
    { text: 'Indicator', key: 'indicator' },
    { text: 'Grid', key: 'grid' },
    { text: 'X-Axis', key: 'xAxis' },
    { text: 'Y-Axis', key: 'yAxis' },
    { text: 'Separator', key: 'separator' },
    { text: 'Crosshair', key: 'crosshair' },
  ]

  return (
    <Modal
      title={i18n('setting', props.locale)}
      width={640}
      height={560}
      buttons={[
        {
          children: i18n('restore_default', props.locale),
          onClick: () => {
            restoreDefault()
          }
        }
      ]}
      onClose={props.onClose}
    >
      <div class="klinecharts-pro-setting-modal-content">
          <div class='sidebar'>
            {
              settingsButton.map(el => (
                <button class={`${currentSetting() == el.key ? 'selected' : ''}`}
                  onclick={() => setCurrentSetting(el.key)}
                >{el.text}</button>
              ))
            }
          </div>
          <div class='content'>
            <Show
              when={currentSetting() === 'trading'}
              fallback={
                <For each={options().filter((el) => el.key.includes(currentSetting()))}>
                  {(option) => {
                    let component
                    const value = utils.formatValue(styles(), option.key)
                    switch (option.component) {
                      case 'select': {
                        component = (
                          <Select
                            style={{ width: '120px' }}
                            value={i18n(value as string, props.locale)}
                            ///@ts-expect-error
                            dataSource={option.dataSource}
                            onSelected={(data) => {
                              const newValue = (data as SelectDataSourceItem).key
                              update(option, newValue)
                            }}
                          />
                        )
                        break
                      }
                      case 'switch': {
                        const open = !!value
                        component = (
                          <Switch
                            open={open}
                            onChange={() => {
                              update(option, !open)
                            }}
                          />
                        )
                        break
                      }
                      case 'color': {
                        component = (
                          <Color
                            style={{ width: '120px' }}
                            value={value as any}
                            reactiveChange={false}
                            onChange={(el) => {
                              const newValue = el
                              update(option, newValue)
                            }}
                          />
                        )
                        break
                      }
                    }
                    return (
                      <>
                        <div class="component">
                          <span>{option.text}</span>
                          {component}
                        </div>
                      </>
                    )
                  }}
                </For>
              }
            >
              <div class="component">
                <span>{i18n('trading_display_positions', props.locale)}</span>
                <Switch
                  open={tradingUi().showPositions}
                  onChange={() => {
                    const next = { ...tradingUi(), showPositions: !tradingUi().showPositions }
                    setTradingUi(next)
                    setTradingConfigState(next)
                  }}
                />
              </div>
              <div class="component">
                <span>{i18n('trading_display_liquidation', props.locale)}</span>
                <Switch
                  open={tradingUi().showLiquidation}
                  onChange={() => {
                    const next = { ...tradingUi(), showLiquidation: !tradingUi().showLiquidation }
                    setTradingUi(next)
                    setTradingConfigState(next)
                  }}
                />
              </div>
              <div class="component">
                <span>{i18n('trading_display_open_orders', props.locale)}</span>
                <Switch
                  open={tradingUi().showOpenOrders}
                  onChange={() => {
                    const next = { ...tradingUi(), showOpenOrders: !tradingUi().showOpenOrders }
                    setTradingUi(next)
                    setTradingConfigState(next)
                  }}
                />
              </div>
              <div class="component">
                <span>{i18n('trading_display_his_orders', props.locale)}</span>
                <Switch
                  open={tradingUi().showHisOrders}
                  onChange={() => {
                    const next = { ...tradingUi(), showHisOrders: !tradingUi().showHisOrders }
                    setTradingUi(next)
                    setTradingConfigState(next)
                  }}
                />
              </div>
            </Show>
          </div>
      </div> 
    </Modal>
  )
}

export default SettingModal
