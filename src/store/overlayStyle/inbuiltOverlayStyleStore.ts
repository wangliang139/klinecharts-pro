import { LineStyle, StateTextStyle } from 'klinecharts';

export const point = {
	color: '#1677FF',
	borderColor: 'rgba(22, 119, 255, 0.35)',
	borderSize: 1,
	radius: 5,
	activeColor: '#1677FF',
	activeBorderColor: 'rgba(22, 119, 255, 0.35)',
	activeBorderSize: 3,
	activeRadius: 5
}

export const text = {
	// 'fill' | 'stroke' | 'stroke_fill'
	style: 'fill',
	color: '#FFFFFF',
	size: 12,
	family: 'Helvetica Neue',
	weight: 'normal',
	// 'solid' | 'dashed'
	borderStyle: 'solid',
	borderDashedValue: [2, 2],
	borderSize: 0,
	borderRadius: 2,
	borderColor: '#1677FF',
	paddingLeft: 0,
	paddingRight: 0,
	paddingTop: 0,
	paddingBottom: 0,
	backgroundColor: 'transparent'
}

export const circle = {
	// 'fill' | 'stroke' | 'stroke_fill'
	style: 'fill',
	color: 'rgba(22, 119, 255, 0.25)',
	borderColor: '#1677FF',
	borderSize: 1,
	// 'solid' | 'dashed'
	borderStyle: 'solid',
	borderDashedValue: [2, 2]
}

export const polygon = circle
export const rect = {
	...circle,
	borderRadius: 0
}

export const arc = {
	// 'solid' | 'dashed'
	style: 'solid',
	color: '#1677FF',
	size: 1,
	dashedValue: [2, 2]
}

export const line = {
	...arc,
	smooth: false,
}

export const positionStyle: { lineStyle: LineStyle, labelStyle: StateTextStyle} = {
	lineStyle: {
		style: 'dashed',
		size: 1,
		color: '#00698b',
		dashedValue: [4, 4]
	},
	labelStyle: {
		style: 'stroke_fill',
		size: 12,
		family:'Helvetica Neue',
		weight: 'normal',
		paddingLeft: 5,
		paddingRight: 5,
		paddingBottom: 5,
		paddingTop: 5,
		borderStyle: 'solid',
		borderSize: 1,
		borderDashedValue: [0,0],
		borderRadius: 3,
		color: '#FFFFFF',
		borderColor: '#00698b',
		backgroundColor: '#00698b',
		show: true,
	}
}
