
import React, { Component } from 'react';
import './DetailsStep.css';

import axios from 'axios';
import { Column } from 'simple-flexbox';

import ColorsForm from '../forms/ColorsForm';
import CornersForm from '../forms/CornersForm';
import ImageryForm from '../forms/ImageryForm';
import TitleForm from '../forms/TitleForm';
import KeywordsForm from "../forms/KeywordsForm";
import TonesForm from "../forms/TonesForm";
import cookie from "react-cookies";


class DetailsStep extends Component {
	constructor(props) {
		super(props);

		this.state = {
			step   : 0,
			form   : {
				email    : '',
				title    : '',
				keywords : [],
				tones    : [],
				colors   : [],
				corners  : [],
				imagery  : []
			}
		};

		this.selectedColors = [];
		this.selectedImagery = [];
	}

	handleStepChange(vals) {
		console.log("handleStepChange()", JSON.stringify(vals));

		let form = this.state.form;

		// title + email
		if (this.state.step === 0) {
			for (let [key, value] of Object.entries(vals)) {
				form[key] = value;
			}

			this.props.onStart(form);

		// keywords
		} else if (this.state.step === 1) {
			for (let [key, value] of Object.entries(vals)) {
				form[key] = value;

				value.forEach(function(item, i) {
					let formData = new FormData();
					formData.append('action', 'ADD_KEYWORD');
					formData.append('order_id', cookie.load('order_id'));
					formData.append('keyword', item.title);
					axios.post('https://api.designengine.ai/templates.php', formData)
						.then((response)=> {
							console.log("ADD_KEYWORD", JSON.stringify(response.data));
						}).catch((error) => {
					});
				});
			}

		// tones
		} else if (this.state.step === 2) {
			for (let [key, value] of Object.entries(vals)) {
				form[key] = value;

				value.forEach(function(item, i) {
					let formData = new FormData();
					formData.append('action', 'ADD_TONE');
					formData.append('order_id', cookie.load('order_id'));
					formData.append('tone', item.title);
					axios.post('https://api.designengine.ai/templates.php', formData)
						.then((response) => {
							console.log("ADD_TONE", JSON.stringify(response.data));
						}).catch((error) => {
					});
				});
			}

			// colors
		} else if (this.state.step === 3) {
			for (let [key, value] of Object.entries(vals)) {
				form[key] = value;

				value.forEach(function(item, i) {
					let formData = new FormData();
					formData.append('action', 'ADD_COLOR');
					formData.append('order_id', cookie.load('order_id'));
					formData.append('keyword', item.keyword);
					formData.append('index', "0");
					formData.append('hex', item.hex);
					axios.post('https://api.designengine.ai/templates.php', formData)
						.then((response) => {
							console.log("ADD_COLOR", JSON.stringify(response.data));
						}).catch((error) => {
					});
				});
			}

			// corners
		} else if (this.state.step === 4) {
			for (let [key, value] of Object.entries(vals)) {
				form[key] = value;

				value.forEach(function(item, i) {
					let formData = new FormData();
					formData.append('action', 'ADD_CORNER');
					formData.append('order_id', cookie.load('order_id'));
					formData.append('name', item.title);
					formData.append('radius', item.amount);
					axios.post('https://api.designengine.ai/templates.php', formData)
						.then((response) => {
							console.log("ADD_CORNER", JSON.stringify(response.data));
						}).catch((error) => {
					});
				});
			}

			// imagery
		} else if (this.state.step === 5) {
			for (let [key, value] of Object.entries(vals)) {
				form[key] = value;

				value.forEach(function(item, i) {
					let formData = new FormData();
					formData.append('action', 'ADD_IMAGE');
					formData.append('order_id', cookie.load('order_id'));
					formData.append('keyword', item.title);
					formData.append('url', item.url);
					axios.post('https://api.designengine.ai/templates.php', formData)
						.then((response) => {
							console.log("ADD_IMAGE", JSON.stringify(response.data));
						}).catch((error) => {
					});
				});
			}
			this.setState({ form : form });
		}

		if (this.state.step < 5) {
			this.setState({
				step : this.state.step + 1,
				form : form
			});

		} else {
			this.props.onClick(form);
		}

		console.log('form', form)

		//this.setState({ [event.target.name] : event.target.value });
	}

	handleBack() {
		this.setState({ step : this.state.step - 1 })
	}

	render() {
// 		const buttonClass = (this.state.isValidated) ? 'action-button full-button' : 'action-button full-button disabled-button';

		return (
			<div>
				<Column flexGrow={1} horizontal="start">
					{this.state.step === 0 && (
						<TitleForm
							onTooltip={(obj)=> this.props.onTooltip(obj)}
							onBack={()=> this.props.onCancel()}
							onNext={(vals)=> this.handleStepChange(vals)} />
					)}

					{this.state.step === 1 && (
						<KeywordsForm onBack={()=> this.handleBack()} onNext={(vals)=> this.handleStepChange(vals)} />
					)}

					{this.state.step === 2 && (
						<TonesForm onBack={()=> this.handleBack()} onNext={(vals)=> this.handleStepChange(vals)} />
					)}

					{this.state.step === 3 && (
						<ColorsForm templateID={this.props.templateID} onBack={()=> this.handleBack()} onNext={(vals)=> this.handleStepChange(vals)} />
					)}

					{this.state.step === 4 && (
						<CornersForm onBack={()=> this.handleBack()} onNext={(vals)=> this.handleStepChange(vals)} />
					)}

					{this.state.step === 5 && (
						<ImageryForm templateID={this.props.templateID} onBack={()=> this.handleBack()} onNext={(vals)=> this.handleStepChange(vals)} />
					)}
				</Column>
			</div>
		);
	}
}

export default DetailsStep;
