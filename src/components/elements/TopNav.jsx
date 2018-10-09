
import React, { Component } from 'react';
import './TopNav.css';

import FontAwesome from 'react-fontawesome';
import { Column, Row } from 'simple-flexbox';

import Dropdown from '../elements/Dropdown';
import DropdownMultiple from '../elements/DropdownMultiple';
import tones from '../../json/tones.json';
import colors from '../../json/colors.json';
import parts from '../../json/parts.json';

class TopNav extends Component {
	constructor(props) {
		super(props);

		this.state = {
			dropdowns : {
				tones    : [],
				colors   : [],
				parts    : [],
			}
		};
	}

	componentDidMount() {
		let list1 = [];
		tones.forEach(function(item, i) {
			list1.push({
				id       : item.id,
				title    : item.title,
				selected : false,
				key      : 'tones'
			});
		});

		let list2 = [];
		colors.forEach(function(item, i) {
			list2.push({
				id       : item.id,
				title    : item.title,
				hex      : item.hex,
				gradient : item.gradient,
				selected : false,
				key      : 'colors'
			});
		});

		let list3 = [];
		parts.forEach(function(item, i) {
			list3.push({
				id       : item.id,
				title    : item.title,
				selected : false,
				key      : 'parts'
			});
		});

		this.setState({
			dropdowns : {
				tones  : list1,
				colors : list2,
				parts  : list3
			}
		});
	}

	toggleSelected = (id, key) => {
		console.log('toggleSelected()', id, key);
		let tmp = [...this.state.dropdowns[key]];
		tmp[id-1].selected = !tmp[id-1].selected;
		this.setState({ [key] : tmp });
// 		this.handleDropdownUpdate(key, tmp[id-1].title);
	};

	resetThenSet = (id, key) => {
		let tmp = [...this.state.dropdowns[key]];
		tmp.forEach(item => item.selected = false);
		tmp[id-1].selected = true;
		this.ddTitle = tmp[id-1].title;
// 		this.handleDropdownUpdate(key, tmp[id-1].title);
	};

	render() {
		return (
			<div className="top-nav-wrapper">
				<Row vertical="start">
					<Column flexGrow={2} horizontal="start" vertical="center" className="top-nav-column">
						<a href="/"><img src="/images/logo.svg" className="nav-logo" alt="Design Engine" /></a>
					</Column>

					<Column flexGrow={5} horizontal="start" vertical="center" className="top-nav-column">
						<div className="full-width">
							<button onClick={()=> this.props.onUpload()}><FontAwesome name="plus" className="top-nav-upload-plus" /></button>
							<Dropdown
								title="Select parts"
								list={this.state.dropdowns.parts}
								resetThenSet={this.resetThenSet}
							/>
							<DropdownMultiple
								titleHelper="Color"
								title="Select color(s)"
								list={this.state.dropdowns.colors}
								toggleItem={this.toggleSelected}
							/>
							<Dropdown
								title="Select tone"
								list={this.state.dropdowns.tones}
								resetThenSet={this.resetThenSet}
							/>
						</div>
					</Column>

					<Column flexGrow={2} horizontal="end" vertical="center" className="top-nav-column">
						{(this.props.parts.length > 0) && (
							<button onClick={()=> this.props.onDownload()}>Download Parts ({this.props.parts.length})</button>
						)}
					</Column>
				</Row>
			</div>
		);
	}
}

export default TopNav;
