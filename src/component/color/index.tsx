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

import { createSignal, Component, JSX } from 'solid-js'
import chroma from "chroma-js";

export interface ColorProps {
	class?: string
	style?: JSX.CSSProperties | string
	value?: JSX.Element
	valueKey?: string
	reactiveChange?: boolean
	onChange?: (data: string) => void
}

const Color: Component<ColorProps> = props => {
	// const op = chroma(String(props.value)).alpha() * 100
	const op = String(props.value).includes('rgba') ? chroma(String(props.value)).alpha() * 100 : 100
	const [open, setOpen] = createSignal(false)
	const [opacity, setOpacity] = createSignal(op)
	const [selectedColor, setSelectedColor] = createSignal(props.value)
	const [finalColor, setFinalColor] = createSignal(props.value)
	const [rangeFocused, setRangeFocused] = createSignal(false)

	// new signals for custom picker (extended)
	const [customMode, setCustomMode] = createSignal(false)
	const [pickerHex, setPickerHex] = createSignal<string>((props.value as string) ?? '#000000')
	const [hue, setHue] = createSignal<number>(0)
	// saturation and lightness 0..1
	const [sat, setSat] = createSignal<number>(1)
	const [light, setLight] = createSignal<number>(0.5)
	const [squareDragging, setSquareDragging] = createSignal(false)

	const colors = [
		[
			'rgb(255, 255, 255)',
			'rgb(219, 219, 219)',
			'rgb(184, 184, 184)',
			'rgb(156, 156, 156)',
			'rgb(128, 128, 128)',
			'rgb(99, 99, 99)',
			'rgb(74, 74, 74)',
			'rgb(46, 46, 46)',
			'rgb(15, 15, 15)',
			'rgb(0, 0, 0)'
		],
		[
			'rgb(242, 54, 69)',
			'rgb(255, 152, 0)',
			'rgb(255, 235, 59)',
			'rgb(76, 175, 80)',
			'rgb(8, 153, 129)',
			'rgb(0, 188, 212)',
			'rgb(41, 98, 255)',
			'rgb(103, 58, 183)',
			'rgb(156, 39, 176)',
			'rgb(233, 30, 99)'
		],
		[
			'rgb(252, 203, 205)',
			'rgb(255, 224, 178)',
			'rgb(255, 249, 196)',
			'rgb(200, 230, 201)',
			'rgb(172, 229, 220)',
			'rgb(178, 235, 242)',
			'rgb(187, 217, 251)',
			'rgb(209, 196, 233)',
			'rgb(225, 190, 231)',
			'rgb(248, 187, 208)'
		],
		[
			'rgb(250, 161, 164)',
			'rgb(255, 204, 128)',
			'rgb(255, 245, 157)',
			'rgb(165, 214, 167)',
			'rgb(112, 204, 189)',
			'rgb(128, 222, 234)',
			'rgb(144, 191, 249)',
			'rgb(179, 157, 219)',
			'rgb(206, 147, 216)',
			'rgb(244, 143, 177)'
		],
		[
			'rgb(247, 124, 128)',
			'rgb(255, 183, 77)',
			'rgb(255, 241, 118)',
			'rgb(129, 199, 132)',
			'rgb(66, 189, 168)',
			'rgb(77, 208, 225)',
			'rgb(91, 156, 246)',
			'rgb(149, 117, 205)',
			'rgb(186, 104, 200)',
			'rgb(240, 98, 146)'
		],
		[
			'rgb(247, 82, 95)',
			'rgb(255, 167, 38)',
			'rgb(255, 238, 88)',
			'rgb(102, 187, 106)',
			'rgb(34, 171, 148)',
			'rgb(38, 198, 218)',
			'rgb(49, 121, 245)',
			'rgb(126, 87, 194)',
			'rgb(171, 71, 188)',
			'rgb(236, 64, 122)'
		],
		[
			'rgb(178, 40, 51)',
			'rgb(245, 124, 0)',
			'rgb(251, 192, 45)',
			'rgb(56, 142, 60)',
			'rgb(5, 102, 86)',
			'rgb(0, 151, 167)',
			'rgb(24, 72, 204)',
			'rgb(81, 45, 168)',
			'rgb(123, 31, 162)',
			'rgb(194, 24, 91)'
		],
		[
			'rgb(128, 25, 34)',
			'rgb(230, 81, 0)',
			'rgb(245, 127, 23)',
			'rgb(27, 94, 32)',
			'rgb(0, 51, 42)',
			'rgb(0, 96, 100)',
			'rgb(12, 50, 153)',
			'rgb(49, 27, 146)',
			'rgb(74, 20, 140)',
			'rgb(136, 14, 79)'
		]
	]

	// helper: safe chroma parse -> hex
	const toHex = (input: any) => {
		try {
			return chroma(input).hex()
		} catch {
			return String(input || '#000000')
		}
	}

	// initialize picker from a color (hex or css)
	const initPickerFromColor = (input: string) => {
		const hex = toHex(input)
		const [h, s, l] = chroma(hex).hsl()
		setHue(Number.isFinite(h) ? Math.round(h) : 0)
		setSat(Number.isFinite(s) ? s : 1)
		setLight(Number.isFinite(l) ? l : 0.5)
		setPickerHex(hex)
	}

	const closeColorPallete = () => {
		setOpen(false)
		setCustomMode(false)
	}
	const cancelColorChange = () => {
		setSelectedColor(props.value)
		setFinalColor(props.value)
		props.onChange?.((props.value as string))
		closeColorPallete()
	}

	const applySelectedColor = (col: string) => {
		setSelectedColor(col)
		const op = opacity() / 100
		const x = chroma(col).alpha(op).css()
		setFinalColor(x)
		if (props.reactiveChange ?? true) props.onChange?.(x)
	}

	const addOpacity = () => {
		const op = opacity() / 100
		const x = chroma(selectedColor() as any).alpha(op).css();
		setFinalColor(x)
		if (props.reactiveChange ?? true)
			props.onChange?.((x as string))
	}

	const handleRangeChange = (event: any) => {
		setOpacity(event.target.value);
		addOpacity()
	}

	// custom picker helpers
	const openCustomPicker = () => {
		const cur = selectedColor() ?? props.value ?? '#000000'
		initPickerFromColor(String(cur))
		setCustomMode(true)
		setOpen(true)
	}

	const onHueChange = (val: number) => {
		setHue(val)
		// update picker hex from h, current s/l
		const col = chroma.hsl(val, sat(), light()).hex()
		setPickerHex(col)
	}

	const onHexInput = (val: string) => {
		let v = val.trim()
		if (!v.startsWith('#')) v = '#' + v
		try {
			const hex = chroma(v).hex()
			const [h, s, l] = chroma(hex).hsl()
			setHue(Number.isFinite(h) ? Math.round(h) : hue())
			setSat(Number.isFinite(s) ? s : sat())
			setLight(Number.isFinite(l) ? l : light())
			setPickerHex(hex)
		} catch {
			// set raw value (invalid) so user sees their input
			setPickerHex(val)
		}
	}

	// pointer handlers for the big color square (saturation x, lightness y)
	const onSquarePointerDown = (e: PointerEvent) => {
		;(e.target as Element).setPointerCapture?.(e.pointerId)
		setSquareDragging(true)
		handleSquarePointer(e)
	}
	const onSquarePointerMove = (e: PointerEvent) => {
		if (!squareDragging()) return
		handleSquarePointer(e)
	}
	const onSquarePointerUp = (e: PointerEvent) => {
		try { (e.target as Element).releasePointerCapture?.(e.pointerId) } catch {}
		setSquareDragging(false)
	}
	const handleSquarePointer = (e: PointerEvent) => {
		const target = e.currentTarget as HTMLElement
		const rect = target.getBoundingClientRect()
		const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width)
		const y = Math.min(Math.max(0, e.clientY - rect.top), rect.height)
		const s = rect.width ? x / rect.width : 0
		const l = rect.height ? 1 - (y / rect.height) : 0.5 // top = light (higher), bottom = dark
		setSat(s)
		setLight(l)
		const col = chroma.hsl(hue(), s, l).hex()
		setPickerHex(col)
	}

	const addCustomColorToPalette = () => {
		try {
			const hex = toHex(pickerHex())
			// insert into first palette row at start (recent)
			colors[0].unshift(hex)
			// select it
			applySelectedColor(hex)
			setCustomMode(false)
		} catch (err) {
			// ignore invalid color
		}
	}

	return (
		<>
			{open() && (
				<div
					class="klinecharts-pro-color-backdrop"
					aria-hidden="true"
					onClick={() => {
						cancelColorChange()
					}}
				/>
			)}
		<div
			style={`width: 120px; background-color: ${finalColor()}`}
			class={`klinecharts-pro-color ${props.class ?? ''} ${open() ? 'klinecharts-pro-color-show' : ''}`}
			tabIndex="0"
		>
			<div class="selector-container"
				onClick={(e) => {
					setOpen(true)
				}}
			>
				<i class="arrow" />
			</div>

			<div class="drop-down-container" style={`left: 50%; top: 20%`}>
				{
					// when not in custom mode render palette rows
					!customMode() && colors.map((data: any) => {
						return (
							<div class="each_line">
								{
									data.map((d: any) => {
										return (
											<div class={`each_color ${d == selectedColor() ? 'selected' : ''}`} style={`background-color: ${d}`}
												onClick={e => {
													e.preventDefault()
													applySelectedColor(d)
												}}>
											</div>
										)
									})
								}
							</div>
						)
					})
				}

				{
					// plus button shown only when not in customMode
					!customMode() && (
						<div class="each_line" style="display:flex; align-items:center; gap:8px;">
							<div style="width:24px;height:24px;border-radius:4px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.04);cursor:pointer"
								onClick={(e) => { e.stopPropagation(); openCustomPicker(); }}>
								<span style="font-size:18px;line-height:1; color:var(--klinecharts-pro-text-color,#fff)">+</span>
							</div>
						</div>
					)
				}

				{
					// custom picker UI (replaced)
					customMode() && (
						<div style="display:flex;flex-direction:column;gap:8px;padding:6px;width:260px;">
							<div style="display:flex;gap:8px;align-items:center;">
								<div style={`width:40px;height:40px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);background:${pickerHex()}`}></div>
								<input
									style="flex:1;padding:6px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);background:transparent;color:inherit"
									value={pickerHex()}
									onInput={(e) => onHexInput((e.currentTarget as HTMLInputElement).value)}
								/>
							</div>

							{/* big saturation/lightness square */}
							<div
								style="width:220px;height:140px;border-radius:6px;position:relative;touch-action:none;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.2)"
								onPointerDown={(e) => onSquarePointerDown(e as unknown as PointerEvent)}
								onPointerMove={(e) => onSquarePointerMove(e as unknown as PointerEvent)}
								onPointerUp={(e) => onSquarePointerUp(e as unknown as PointerEvent)}
							>
								{/* saturation gradient (left -> right) for current hue */}
								<div style={{
									position: 'absolute',
									inset: 0,
									///@ts-expect-error
									borderRadius: '6px',
									background: `linear-gradient(to right, hsl(${hue()}, 0%, 50%), hsl(${hue()}, 100%, 50%))`
								}}></div>
								{/* lightness gradient (top -> transparent) to simulate brightness */}
								<div style={{
									position: 'absolute',
									inset: 0,
									///@ts-expect-error
									borderRadius: '6px',
									background: 'linear-gradient(to top, #ffffff, rgba(255,255,255,0))',
									mixBlendMode: 'overlay',
									opacity: 0.6
								}}></div>
								<div style={{
									position: 'absolute',
									inset: 0,
									///@ts-expect-error
									borderRadius: '6px',
									background: 'linear-gradient(to bottom, rgba(0,0,0,0), #000)',
									opacity: 0.6
								}}></div>

								{/* picker dot */}
								<div style={{
									position: 'absolute',
									left: `${Math.round(sat()*100)}%`,
									top: `${Math.round((1 - light())*100)}%`,
									transform: 'translate(-50%,-50%)',
									width: '12px',
									height: '12px',
									///@ts-expect-error
									borderRadius: '50%',
									boxShadow: '0 0 0 2px rgba(255,255,255,0.9)',
									border: '1px solid rgba(0,0,0,0.6)',
									background: pickerHex()
								}} />
							</div>

							{/* hue slider */}
							<div style="display:flex;align-items:center;gap:8px;">
								<input
									type="range"
									min="0"
									max="360"
									value={hue()}
									onInput={e => onHueChange(Number((e.currentTarget as HTMLInputElement).value))}
									style="flex:1; height:10px; background: linear-gradient(90deg, red 0%, yellow 17%, lime 33%, cyan 50%, blue 67%, magenta 83%, red 100%); border-radius:6px; padding:0;"
								/>
								<span style="width:38px;text-align:center;">{hue()}</span>
							</div>

							{/* actions */}
							<div style="display:flex;gap:8px;justify-content:flex-end;">
								<button class="cancel" onClick={() => setCustomMode(false)}>Cancel</button>
								<button class="ok" onClick={addCustomColorToPalette}>Add</button>
							</div>
						</div>
					)
				}

				<div class="split_line"></div>

				<div class="range_div">
					<input class="range" style={`background-color: ${finalColor()}; border: 1px solid ${selectedColor()}`}
						type="range" min="1" max="100" value={opacity()}
						onInput={(e) => { e.preventDefault; handleRangeChange(e); }}
						onFocus={() => {
							setRangeFocused(true)
						}}
						onBlur={() => {
							setRangeFocused(false)
						}}
					/>
					<p>{opacity()}%</p>
				</div>
				<div class="split_line"></div>
				<div class="submit">
					<span class="cancel" onClick={cancelColorChange}>Cancel</span>
					<span onclick={
						() => {
							if (props.reactiveChange === false)
								props.onChange?.(finalColor() as string)
							closeColorPallete()
						}
					}>Ok</span>
				</div>
			</div>
		</div>
		</>
	)
}

export default Color
