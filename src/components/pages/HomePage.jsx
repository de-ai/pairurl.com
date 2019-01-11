
import React, { Component } from 'react';
import './HomePage.css';

import axios from 'axios';
import { connect } from 'react-redux';
// import { Switch, Route } from 'react-router-dom';

import ArtboardGrid from '../elements/ArtboardGrid';
import UploadHeader from '../elements/UploadHeader';
import { addFileUpload, appendUploadArtboards } from '../../redux/actions';
import { isInspectorPage, limitString } from '../../utils/funcs';


const mapStateToProps = (state, ownProps)=> {
	return ({
		artboards  : state.uploadArtboards,
		navigation : state.navigation,
		profile    : state.userProfile
	});
};

const mapDispatchToProps = (dispatch)=> {
	return ({
		addFileUpload         : (file)=> dispatch(addFileUpload(file)),
		appendUploadArtboards : (artboards)=> dispatch(appendUploadArtboards(artboards))
	});
};


class HomePage extends Component {
	constructor(props) {
		super(props);

		this.state = {
			firstFetch  : false,
			uploadTotal : 0,
			fetching    : false,
			loadOffset  : 0,
			loadAmt     : 1
		};
	}

	componentDidMount() {
		console.log('HomePage().componentDidMount()', this.props);

		if (this.props.profile && this.props.artboards.length === 0) {
			this.handleLoadNext();
		}

		if (this.props.artboards.length > 0) {
			this.setState({ uploadTotal : this.props.artboards.length })
		}
	}

	shouldComponentUpdate(nextProps, nextState, nextContext) {
		console.log('HomePage.shouldComponentUpdate()', this.props, nextProps);

		const { fetching, uploadTotal } = this.state;
		return (!fetching || nextProps.artboards.length === uploadTotal);
	}

	componentDidUpdate(prevProps, prevState, snapshot) {
		console.log('HomePage.componentDidUpdate()', prevProps, this.props);

		const { artboards } = this.props;
		if (!this.state.firstFetch && this.props.profile && artboards.length === 0) {
			this.setState({ firstFetch : true });
			this.handleLoadNext();
		}

		const { fetching, uploadTotal } = this.state;
		if (fetching && artboards.length === uploadTotal && uploadTotal > 0) {
			this.setState({ fetching : false });
		}
	}

	handleDemo = ()=> {
		console.log('HomePage.handleDemo()', this.props.path);
		this.props.onPage('/page/1/2/4/account');
// 		this.props.onPage('/page');
	};


	handleLoadNext = ()=> {
		console.log('HomePage.handleLoadNext()', this.props.artboards);

		const { profile, navigation } = this.props;
		const { loadOffset, loadAmt } = this.state;
		this.setState({ fetching : true });

		let formData = new FormData();
		formData.append('action', 'UPLOAD_NAMES');
		formData.append('user_id', profile.id);
		formData.append('offset', '0');
		formData.append('length', '-1');
		axios.post('https://api.designengine.ai/system.php', formData)
			.then((response) => {
				console.log('UPLOAD_NAMES', response.data);

				const uploads = response.data.uploads.map((upload)=> ({
					id           : upload.id,
					title        : upload.title,
					description  : upload.description,
					total        : upload.total,
					added        : upload.added,
					selected     : (navigation.uploadID === upload.id),
					fonts        : upload.fonts.map((font)=> ({
						id     : font.id,
						family : font.family,
						style  : font.style,
						added  : font.added
					})),
					colors       : upload.colors.map((color)=> ({
						id    : color.id,
						hex   : color.hex_val,
						added : color.added
					})),
					symbols      : upload.fonts.map((symbol)=> ({
						id    : symbol.id,
						uuid  : symbol.uuid,
						title : symbol.title,
						added : symbol.added
					})),
					pages        : upload.pages.map((page) => ({
						id          : page.id,
						uploadID    : page.upload_id,
						title       : page.title,
						description : page.description,
						total       : page.total,
						added       : page.added,
						selected    : (navigation.pageID === page.id && isInspectorPage()),
						artboards   : []
					})),
					contributors : upload.contributors.map((contributor)=> ({
						id     : contributor.id,
						title  : contributor.username,
						avatar : contributor.avatar
					}))
				}));

				this.setState({
					uploadTotal : uploads.length,
					loadOffset  : loadOffset + loadAmt
				});

				if (uploads.length === 0) {
					this.setState({ fetching : false });
				}

				uploads.forEach((upload)=> {
					this.handleNextUpload(upload);
				});
			}).catch((error) => {
		});
	};


	handleNextUpload = (upload)=> {
// 		console.log('!¡!¡!¡!¡!¡!¡!¡!¡!¡— HomePage.handleNextUpload()', upload);

		const prevArtboards = [...this.props.artboards];
		const { loadOffset } = this.state;

		let formData = new FormData();
		formData.append('action', 'ARTBOARDS');
		formData.append('upload_id', upload.id);
		formData.append('page_id', '0');
		formData.append('offset', '0');
		formData.append('length', '1');
		axios.post('https://api.designengine.ai/system.php', formData)
			.then((response) => {
				console.log('ARTBOARDS', response.data);
				const artboards = prevArtboards.concat(response.data.artboards.map((artboard) => ({
					id        : artboard.id,
					pageID    : artboard.page_id,
					uploadID  : artboard.upload_id,
					system    : artboard.system,
					title     : limitString(upload.title, 16) + ' - ' + artboard.title,
					pageTitle : artboard.page_title,
					type      : artboard.type,
					filename  : artboard.filename,
					creator   : artboard.creator,
					meta      : JSON.parse(artboard.meta),
					added     : artboard.added,
					selected  : false
				})));

				this.setState({
					loadOffset : loadOffset + artboards.length,
					fetching   : artboards.length !== this.props.artboards.length
				});

				this.props.appendUploadArtboards(artboards);
			}).catch((error) => {
		});
	};

	handleFile = (file)=> {
		console.log('HomePage.handleFile()', file);
		this.props.addFileUpload(file);
		this.props.onPage('new' + window.location.pathname);
	};


	render() {
		console.log('HomePage.render()', this.props, this.state);

		const { profile, artboards } = this.props;
		const { fetching, loadOffset, uploadTotal } = this.state;

		const { pathname } = window.location;
		const headerTitle = (pathname === '/' || pathname === '/inspect') ? 'Drag & Drop any design file to inspect specs & code.' : (pathname === '/parts') ? 'Drag & Drop any design file to download parts.' : (pathname === '/colors') ? 'Drag & Drop any design file to view it\'s colors.' : (pathname === '/typography') ? 'Drag & Drop any design file to view it\'s fonts.' : 'Turn any Sketch file into an organized System of Fonts, Colors, Symbols, Views &amp; more. (Drag & Drop)';
		const gridTitle = (profile) ? (fetching) ? 'Loading…' : 'Showing most viewed from ' + uploadTotal + ' project' + ((uploadTotal === 1) ? '' : 's') + '.' : null;
		return (
			<div className="page-wrapper home-page-wrapper">
				<UploadHeader
					title={headerTitle}
					onFile={this.handleFile}
					onDemo={this.handleDemo}
					onPopup={this.props.onPopup} />

				<ArtboardGrid
					title={gridTitle}
					total={uploadTotal}
					artboards={artboards.sort((a, b)=> (a.id > b.id) ? 1 : ((b.id > a.id) ? -1 : 0))}
					loadOffset={loadOffset}
					fetching={fetching}
					onClick={this.props.onArtboardClicked}
					onItemClick={this.props.onPage}
					onPage={this.props.onPage}
					onFile={this.handleFile}
					onPopup={this.props.onPopup}
					onLoadNext={this.handleLoadNext} />
			</div>
		);
	}
}

export default connect(mapStateToProps, mapDispatchToProps)(HomePage);
