
import React, { Component } from 'react';
import './App.css';

import axios from 'axios';
import cookie from 'react-cookies';
import ReactPixel from 'react-facebook-pixel';
import { Route, Switch, withRouter } from 'react-router-dom'

import SideNav from './components/elements/SideNav';
import TopNav from './components/elements/TopNav';
import BottomNav from './components/elements/BottomNav';
import AddOnsPage from './components/pages/AddOnsPage';
import APIPage from './components/pages/APIPage';
import ExplorePage from './components/pages/ExplorePage';
import HomePage from './components/pages/HomePage';
import InspectorPage from './components/pages/InspectorPage';
import InviteTeamPage from "./components/pages/InviteTeamPage";
import LoginPage from './components/pages/LoginPage';
import MissionPage from './components/pages/MissionPage';
import PrivacyPage from './components/pages/PrivacyPage';
import RecoverPage from './components/pages/RecoverPage';
import RegisterPage from './components/pages/RegisterPage';
import Status404Page from './components/pages/Status404Page';
import TermsPage from './components/pages/TermsPage';
import UploadPage from './components/pages/UploadPage';

import StripeOverlay from './components/elements/StripeOverlay';


const wrapper = React.createRef();

class App extends Component {
	constructor(props) {
		super(props);

		const artboardPatt = /\/artboard\/\d+\/\d+\/\d+\/.*$/;
		const uploadPatt = /\/proj\/\d+\/.*$/;

		this.state = {
			uploadID          : (artboardPatt.test(window.location.pathname)) ? window.location.pathname.match(/\/artboard\/(\d+)\/.*$/)[1] : (uploadPatt.test(window.location.pathname)) ? window.location.pathname.match(/\/proj\/(\d+)\/.*$/)[1] : 0,
			pageID            : (artboardPatt.test(window.location.pathname)) ? window.location.pathname.match(/\/artboard\/\d+\/(\d+)\/.*$/)[1] : 0,
			artboardID        : (artboardPatt.test(window.location.pathname)) ? window.location.pathname.match(/\/artboard\/\d+\/\d+\/(\d+)\/.*$/)[1] : 0,
			sliceID           : 0,//(window.location.pathname.includes('/artboard/')) ? window.location.pathname.match(/\/artboard\/\d+\/\d+\/.+\/(\d+)?/)[1] : 0,
			selectedArtboards : [],
			overlayAlert      : null,
			userID            : 0,
			processing        : false
		};
	}

	componentDidMount() {
		const advancedMatching = { em: 'some@email.com' };
		const options = {
			autoConfig : true,
			debug      : false
		};

		if (typeof cookie.load('user_id') === 'undefined') {
			cookie.save('user_id', '0', { path : '/' });
		}

		ReactPixel.init('318191662273348', advancedMatching, options);
		ReactPixel.trackCustom('load');

		if (window.location.pathname.includes('/artboard/')) {
			let formData = new FormData();

			if (this.state.uploadID === 0) {
				formData.append('action', 'PAGE');
				formData.append('page_id', this.state.pageID);
				axios.post('https://api.designengine.ai/system.php', formData)
					.then((response) => {
						console.log('PAGE', response.data);
						this.setState({ uploadID : response.data.page.upload_id });
					}).catch((error) => {
				});
			}

			formData.append('action', 'ADD_VIEW');
			formData.append('artboard_id', this.state.artboardID);
			axios.post('https://api.designengine.ai/system.php', formData)
				.then((response) => {
					console.log('ADD_VIEW', response.data);
				}).catch((error) => {
			});
		}
	}

	handleHome = ()=> {
		wrapper.current.scrollTo(0, 0);

		this.setState({
			uploadID   : 0,
			pageID     : 0,
			artboardID : 0
		});

		this.props.history.push('/');
	};

	handleSideNavUploadItem = (obj)=> {
		console.log('handleSideNavUploadItem()', obj);

		//if (obj.selected) {
		this.handlePage('proj/' + obj.id + '/' + obj.title.replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '').toLowerCase());
			//this.props.history.push('/proj/' + obj.id + '/' + obj.title.replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '').toLowerCase());
		//}

		this.setState({
			uploadID   : (obj.selected) ? obj.id : -1,
			pageID     : 0,
			artboardID : 0
		});
	};

	handleSideNavPageItem = (obj)=> {
		console.log('handleSideNavPageItem()', obj);

		if (obj.selected) {
			let formData = new FormData();
			formData.append('action', 'ARTBOARDS');
			formData.append('upload_id', this.state.uploadID);
			formData.append('page_id', obj.id);
			formData.append('slices', '0');
			axios.post('https://api.designengine.ai/system.php', formData)
				.then((response) => {
					console.log('ARTBOARDS', response.data);

					const artboard = response.data.artboards[0];
					formData.append('action', 'ADD_VIEW');
					formData.append('artboard_id', obj.id);
					axios.post('https://api.designengine.ai/system.php', formData)
						.then((response) => {
							console.log('ADD_VIEW', response.data);
							this.props.history.push('/artboard/' + this.state.uploadID + '/' + obj.id + '/' + artboard.id + '/' + artboard.title.replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '').toLowerCase());
							this.setState({
								pageID     : obj.id,
								artboardID : artboard.id
							});
						}).catch((error) => {
					});
				}).catch((error) => {
			});

		} else {
			this.setState({ pageID : 0 });
		}
	};

	handleSideNavArtboardItem = (obj)=> {
		console.log('handleSideNavArtboardItem()', obj);
		let formData = new FormData();
		formData.append('action', 'ADD_VIEW');
		formData.append('artboard_id', obj.id);
		axios.post('https://api.designengine.ai/system.php', formData)
			.then((response) => {
				console.log('ADD_VIEW', response.data);
				this.props.history.push('/artboard/' + this.state.uploadID + '/' + obj.pageID + '/' + obj.id + '/' + obj.title.replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '').toLowerCase());
				this.setState({
					pageID     : obj.pageID,
					artboardID : obj.id
				});
			}).catch((error) => {
		});
	};

	handleSideNavSliceItem = (obj)=> {
		console.log('handleSideNavSliceItem()', obj);
// 		this.props.history.push('/artboard/' + this.state.pageID + '/' + this.state.artboardID + '/' + obj.id);
// 		this.setState({ sliceID : obj.id });
	};

	handleArtboardClicked = (artboard)=> {
		console.log('handleArtboardClicked()', artboard);

		let formData = new FormData();
		formData.append('action', 'ADD_VIEW');
		formData.append('artboard_id', artboard.id);
		axios.post('https://api.designengine.ai/system.php', formData)
			.then((response) => {
				console.log('ADD_VIEW', response.data);
				this.props.history.push('/artboard/' + this.state.uploadID + '/' + artboard.pageID + '/' + artboard.id + '/' + artboard.title.replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '').toLowerCase());
				this.setState({
					pageID     : artboard.pageID,
					artboardID : artboard.id
				});
				wrapper.current.scrollTo(0, 0);
			}).catch((error) => {
		});
	};

	handleOverlay = (overlayType, buttonType)=> {
		console.log('handleOverlay()', overlayType, buttonType);
		this.setState({ overlayAlert : null });
		if (overlayType === 'register') {
			if (buttonType === 'submit') {
				window.location.reload();
			}

		} else if (overlayType === 'upload') {
			if (buttonType === 'background') {
				window.location.reload();

			} else if (buttonType === 'complete') {
				window.location.reload();
			}
		}
	};

	handleAddOns = ()=> {
		console.log('handleAddOns()');
// 		this.setState({ overlayAlert: 'download' });
	};

	handleLogout = ()=> {
		cookie.save('user_id', '0', { path : '/' });
		cookie.save('upload_id', '0', { path : '/' });
		cookie.remove('user_email', { path : '/' });
		window.location.href = '/';

	};

	handleProcess = ()=> {
		wrapper.current.scrollTo(0, 0);
		this.setState({ processing : true });
	};

	handlePage = (url)=> {
		console.log('handlePage()', url);
		wrapper.current.scrollTo(0, 0);

		if (url === '//') {
			this.props.history.goBack();

		} else if (url === '') {
			this.setState({
				uploadID   : 0,
				pageID     : 0,
				artboardID : 0
			});

			if (window.location.pathname === '/') {
				window.location.href = '/';

			} else {
				this.props.history.push('/');
			}

		} else {
			if (window.location.pathname === '/' + url) {
				window.location.href = '/' + url;

			} else {
				this.props.history.push('/' + url);
			}
		}
	};

  render() {
  	console.log('App.state', this.state);

  	return (
    	<div className="site-wrapper">
		    <TopNav
			    parts={this.state.selectedArtboards}
			    uploadID={this.state.uploadID}
			    onHome={()=> this.handleHome()}
			    onPage={(url)=> this.handlePage(url)}
		    />
		    <SideNav
			    userID={cookie.load('user_id')}
			    uploadID={this.state.uploadID}
			    pageID={this.state.pageID}
			    artboardID={this.state.artboardID}
			    sliceID={this.state.sliceID}
			    processing={this.state.processing}
			    onUploadItem={(obj)=> this.handleSideNavUploadItem(obj)}
			    onPageItem={(obj)=> this.handleSideNavPageItem(obj)}
			    onArtboardItem={(obj)=> this.handleSideNavArtboardItem(obj)}
			    onSliceItem={(obj)=> this.handleSideNavSliceItem(obj)}
			    onRegister={()=> this.setState({ overlayAlert: 'register' })}
			    onLogout={()=> this.handleLogout()}
			    onUpload={()=> this.handlePage('upload')}
			    onPage={(url)=> this.handlePage(url)}
		    />

		    <div className="content-wrapper" ref={wrapper}>
			    <Switch>
				    <Route exact path="/" render={()=> <HomePage uploadID={this.state.uploadID} pageID={this.state.pageID} onPage={(url)=> this.handlePage(url)} onArtboardClicked={(artboard)=> this.handleArtboardClicked(artboard)} />} />
			      <Route exact path="/add-ons" render={()=> <AddOnsPage onPage={(url)=> this.handlePage(url)} />} />
			      <Route exact path="/api" render={()=> <APIPage onPage={(url)=> this.handlePage(url)} onLogout={()=> this.handleLogout()} />} />
				    <Route exact path="/artboard/:uploadID/:pageID/:artboardID/:artboardSlug" render={(props)=> <InspectorPage {...props} onPage={(url)=> this.handlePage(url)} />} />
				    <Route exact path="/explore" render={()=> <ExplorePage onPage={(url)=> this.handlePage(url)} onArtboardClicked={(artboard)=> this.handleArtboardClicked(artboard)} />} />
				    <Route exact path="/invite-team" render={()=> <InviteTeamPage uploadID={this.state.uploadID} />} />
				    <Route exact path="/login" render={()=> <LoginPage onPage={(url)=> this.handlePage(url)} />} />
			      <Route exact path="/mission" render={()=> <MissionPage />} />
				    <Route exact path="/new" render={()=> <UploadPage onPage={(url)=> this.handlePage(url)} onArtboardClicked={(artboard)=> this.handleArtboardClicked(artboard)} onProcess={()=> this.handleProcess()} />} />
			      <Route exact path="/privacy" render={()=> <PrivacyPage />} />
				    <Route path="/proj/" render={()=> <HomePage uploadID={this.state.uploadID} pageID={this.state.pageID} onPage={(url)=> this.handlePage(url)} onArtboardClicked={(artboard)=> this.handleArtboardClicked(artboard)} />} />
				    <Route exact path="/recover" render={()=> <RecoverPage />} />
				    <Route exact path="/recover/password" render={()=> <RecoverPage />} />
				    <Route exact path="/register" render={()=> <RegisterPage />} />
			      <Route exact path="/terms" render={()=> <TermsPage />} />
			      <Route render={()=> <Status404Page />} />
			    </Switch>

			    <BottomNav wrapperHeight={(wrapper.current) ? wrapper.current.clientHeight : 0} onPage={(url)=> this.handlePage(url)} onLogout={()=> this.handleLogout()} />
		    </div>

		    {(this.state.overlayAlert === 'payment') && (
			    <StripeOverlay onClick={(buttonType)=> this.handleOverlay('download', buttonType)} />
		    )}
	    </div>
    );
  }
}

export default withRouter(App);
