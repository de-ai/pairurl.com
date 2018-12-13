
import React, { Component } from 'react';
import './SliceItem.css'

class SliceItem extends Component {
	constructor(props) {
		super(props);
		this.state = {
		};
	}

	render() {
		const className = (this.props.type === 'slice') ? 'slice-item slice-item-slice' : (this.props.type === 'hotspot') ? 'slice-item slice-item-hotspot' : (this.props.type === 'textfield') ? 'slice-item slice-item-textfield' : 'slice-item slice-item-background';
		const style = {
			top     : this.props.top + 'px',
			left    : this.props.left + 'px',
			width   : this.props.width + 'px',
			height  : this.props.height + 'px',
			zoom    : this.props.scale,
// 			transform : 'scale(' + this.props.scale + ')'
			display : (this.props.visible) ? 'block' : 'none'
		};

		return (
			<div data-id={this.props.id} className={className + ((this.props.filled) ? '-filled' : '')} style={style} onMouseEnter={()=> this.props.onRollOver({ x : this.props.offsetX, y : this.props.offsetY })} onMouseLeave={()=> this.props.onRollOut()} onClick={()=> this.props.onClick({ x : this.props.offsetX, y : this.props.offsetY })}>
			</div>
		);
	}
}

export default SliceItem;
