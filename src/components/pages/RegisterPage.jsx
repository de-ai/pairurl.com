
import React, { Component } from 'react';
import './RegisterPage.css';

import axios from "axios/index";
import cookie from "react-cookies";
import { Column, Row } from 'simple-flexbox';
import ReactPixel from "react-facebook-pixel";

class RegisterPage extends Component {
	constructor(props) {
		super(props);

		this.state = {
			action        : '',
			username      : '',
			email         : '',
			password      : '',
			password2     : '',
			usernameValid : false,
			emailValid    : false,
			passwordValid : false,
			errorMsg      : ''
		};
	}

	componentDidMount() {
	}

	handleSubmit = (event)=> {
		event.preventDefault();

		let re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

		const { username, email, password, password2 } = this.state;
		const usernameValid = (username.length > 0);
		const emailValid = re.test(String(email).toLowerCase());
		const passwordValid = (password.length > 0);

		if (password === password2) {
			this.setState({
				action        : 'REGISTER',
				usernameValid : usernameValid,
				emailValid    : emailValid,
				passwordValid : passwordValid
			});

			if (usernameValid && emailValid && passwordValid) {
				let formData = new FormData();
				formData.append('action', 'REGISTER');
				formData.append('username', username);
				formData.append('email', email);
				formData.append('password', password);
				formData.append('type', 'user');
				axios.post('https://api.designengine.ai/system.php', formData)
					.then((response) => {
						console.log('REGISTER', response.data);
						if (response.data.status === true) {
							const advancedMatching = { em: 'some@email.com' };
							const options = {
								autoConfig : true,
								debug      : false
							};

							ReactPixel.init('318191662273348', advancedMatching, options);
							ReactPixel.trackCustom('sign-up');

							cookie.save('user_id', response.data.user_id, { path : '/' });
							this.props.onPage('');

						} else {
							this.setState({ errorMsg : 'Email Address Already Signed Up!'});
						}
					}).catch((error) => {
				});
			}

		} else {
			this.setState({ errorMsg : 'Passwords Do Not Match!'});
		}
	};

	render() {
		console.log('RegisterPage.render()');

		const { username, email, password, password2 } = this.state;
		const { action, usernameValid, emailValid, passwordValid, errorMsg } = this.state;
		const usernameClass = (action === '') ? 'input-wrapper' : (action === 'REGISTER' && !usernameValid) ? 'input-wrapper input-wrapper-error' : 'input-wrapper';
		const emailClass = (action === '') ? 'input-wrapper' : (action === 'REGISTER' && !emailValid) ? 'input-wrapper input-wrapper-error' : 'input-wrapper';
		const passwordClass = (action === '') ? 'input-wrapper' : (action === 'REGISTER' && !passwordValid) ? 'input-wrapper input-wrapper-error' : 'input-wrapper';
		const password2Class = (action === '') ? 'input-wrapper' : (action === 'REGISTER' && !passwordValid) ? 'input-wrapper input-wrapper-error' : 'input-wrapper';

		return (
			<div className="page-wrapper register-page-wrapper">
				<h3>Sign Up</h3>
				Enter the email address of each member of your team to invite them to this project.
				<div className="register-page-form-wrapper">
					{(errorMsg !== '') && (<div className="input-wrapper input-wrapper-error"><input type="text" placeholder="" value={errorMsg} disabled /></div>)}
					<form onSubmit={this.handleSubmit}>
						<div className={usernameClass}><input type="text" name="username" placeholder="Enter Username" value={username} onFocus={()=> this.setState({ errorMsg : '', action: '' })} onChange={(event)=> this.setState({ [event.target.name] : event.target.value })} /></div>
						<div className={emailClass}><input type="text" name="email" placeholder="Enter Email Address" value={email} onFocus={()=> this.setState({ errorMsg : '', action: '' })} onChange={(event)=> this.setState({ [event.target.name] : event.target.value })} /></div>
						<div className={passwordClass}><input type="password" name="password" placeholder="Enter Password" value={password} onFocus={()=> this.setState({ errorMsg : '', action: '' })} onChange={(event)=> this.setState({ [event.target.name] : event.target.value })} /></div>
						<div className={password2Class}><input type="password" name="password2" placeholder="Confirm Password" value={password2} onFocus={()=> this.setState({ errorMsg : '', action: '' })} onChange={(event)=> this.setState({ [event.target.name] : event.target.value })} /></div>
						<div className="overlay-button-wrapper"><Row vertical="center">
							<Column><button type="submit" className="adjacent-button" onClick={(event)=> this.handleSubmit(event)}>Submit</button></Column>
							<Column><div className="page-link" style={{fontSize:'14px'}} onClick={()=> this.props.onPage('login')}>Already have an account?</div></Column>
						</Row></div>
					</form>
				</div>
			</div>
		);
	}
}

export default RegisterPage;
