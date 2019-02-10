
import React, { Component } from 'react';
import './InspectorPage.css';

import axios from 'axios';
import moment from 'moment-timezone';
import qs from 'qs';
import ReactNotifications from 'react-browser-notifications';
import cookie from 'react-cookies';
import CopyToClipboard from 'react-copy-to-clipboard';
import FontAwesome from 'react-fontawesome';
import Moment from 'react-moment';
import { connect } from 'react-redux';
import { Column, Row } from 'simple-flexbox';

// import ContentModal, { MODAL_SIZE_PERCENT } from '../elements/ContentModal';
import ContentModal from '../elements/ContentModal';
import { POPUP_TYPE_INFO } from '../elements/Popup';
import TutorialOverlay from '../elements/TutorialOverlay';
// import InviteTeamForm from '../forms/InviteTeamForm';

import { MOMENT_TIMESTAMP } from '../../consts/formats';
import { MINUS_KEY, PLUS_KEY } from '../../consts/key-codes';
import { CANVAS_CAPTION, CANVAS_COLORS, MARCHING_ANTS } from '../../consts/slice-canvas';
import { DE_LOGO_SMALL } from '../../consts/uris';
import { setRedirectURI } from '../../redux/actions';
import { buildInspectorPath, buildInspectorURL, capitalizeText, convertURISlug, cropFrame, frameToRect, limitString, makeDownload, rectContainsRect } from '../../utils/funcs.js';
import { fontSpecs, toCSS, toReactCSS, toSpecs, toSwift } from '../../utils/inspector-langs.js';
import { trackEvent } from '../../utils/tracking';
import deLogo from '../../assets/images/logos/logo-designengine.svg';
import bannerPanel from '../../assets/json/banner-panel';
import inspectorTabs from '../../assets/json/inspector-tabs';


const ARTBOARD_ORIGIN = {
	x : 100,
	y : 50
};
const STATUS_INTERVAL = 1250;
const PAN_FACTOR = 0.0025;
// const ZOOM_FACTOR = Math.sqrt(1.5);
const ZOOM_NOTCHES = [
	0.03,
	0.06,
	0.13,
	0.25,
	0.50,
	1.00,
	1.75,
	3.00
];

// const CANVAS_FONT = new FontFace('SFText', 'url()');

const artboardsWrapper = React.createRef();
const canvasWrapper = React.createRef();
const canvas = React.createRef();


const mapStateToProps = (state, ownProps)=> {
	return ({
		deeplink    : state.deeplink,
		profile     : state.userProfile,
		redirectURI : state.redirectURI
	});
};

const mapDispatchToProps = (dispatch)=> {
	return ({
		setRedirectURI : (url)=> dispatch(setRedirectURI(url))
	});
};


const buildUploadArtboards = (upload)=> {
	return ([...upload.pages].flatMap((page)=> (page.artboards)));
};

const artboardByID = (upload, artboardID)=> {
	return (buildUploadArtboards(upload).filter((artboard)=> (artboard.id === artboardID)).pop());
};

const buildSlicePreviews = (upload, slice)=> {
	let slices = [slice];

	artboardByID(upload, slice.artboardID).slices.filter((item)=> (item.id !== slice.id)).forEach((item)=> {
		if (rectContainsRect(frameToRect(slice.meta.frame), frameToRect(item.meta.frame))) {
			slices.push(item);
		}
	});

	return (slices);
};

const drawSliceCaption = (context, text, origin)=> {
	const txtMetrics = {
		width   : context.measureText(text.toUpperCase()).width << 0,
		height  : CANVAS_CAPTION.height,
		padding : CANVAS_CAPTION.padding
	};

	context.fillStyle = 'rgba(0, 0, 0, 0.125)';
	context.fillRect(origin.x + 1, (origin.y - txtMetrics.height) + 1, (txtMetrics.width + (txtMetrics.padding * 2)) - 2, txtMetrics.height - 2);

	context.strokeStyle = CANVAS_CAPTION.lineColor;
	context.lineWidth = 1;
	context.setLineDash([]);
	context.beginPath();
	context.strokeRect(origin.x, origin.y - txtMetrics.height, txtMetrics.width + (txtMetrics.padding * 2), txtMetrics.height);
	context.stroke();

	context.fillStyle = CANVAS_CAPTION.textColor;
	context.fillText(text.toUpperCase(), txtMetrics.padding + origin.x, txtMetrics.padding + (origin.y - txtMetrics.height));
};

const drawSliceBorder = (context, frame)=> {
	context.strokeStyle = CANVAS_COLORS.border;
	context.lineWidth = 1;
	context.setLineDash([]);
	context.beginPath();
	context.strokeRect(frame.origin.x + 1, frame.origin.y + 1, frame.size.width - 2, frame.size.height - 2);
	context.stroke();
};

const drawSliceFill = (context, frame, color)=> {
	context.fillStyle = color;
	context.fillRect(frame.origin.x, frame.origin.y, frame.size.width, frame.size.height);
};

const drawSliceGuides = (context, frame, size, color)=> {
	context.strokeStyle = color;
	context.lineWidth = 2;
	context.setLineDash([4, 2]);
	context.lineDashOffset = 0;
	context.beginPath();
	context.moveTo(0, frame.origin.y);
	context.lineTo(size.width, frame.origin.y); // h-top
	context.moveTo(0, frame.origin.y + frame.size.height);
	context.lineTo(size.width, frame.origin.y + frame.size.height); // h-bottom
	context.moveTo(frame.origin.x, 0);
	context.lineTo(frame.origin.x, size.height); // v-left
	context.moveTo(frame.origin.x + frame.size.width, 0);
	context.lineTo(frame.origin.x + frame.size.width, size.height); // v-right
	context.stroke();
};

const drawSliceMarchingAnts = (context, frame, offset)=> {
	context.strokeStyle = MARCHING_ANTS.STROKE;
	context.lineWidth = MARCHING_ANTS.LINE_WIDTH;
	context.setLineDash(MARCHING_ANTS.LINE_DASH);
	context.lineDashOffset = offset;
	context.beginPath();
	context.strokeRect(frame.origin.x, frame.origin.y, frame.size.width, frame.size.height);
	context.stroke();
};


const ColorSwatch = (props)=> {
// 	console.log('InspectorPage.ColorSwatch()', props);

	const { fill } = props;
	return (<div className="inspector-page-color-swatch" style={{ backgroundColor : fill }} />);
};

/*const InviteTeamModal = (props)=> {
// 	console.log('InspectorPage.InviteTeamModal()', props);

	const { profile, upload, processing } = props;

	return (<ContentModal
		tracking="invite-team/inspector"
		size={MODAL_SIZE_PERCENT}
		closeable={true}
		title="Invite Team"
		onComplete={props.onComplete}>
			<div className="inspector-page-invite-modal-wrapper">
				<div className="inspector-page-invite-modal-message">
					{(processing.state < 3) && (<div><FontAwesome className="inspector-page-processing-spinner" name="spinner" size="2x" pulse fixedWidth /></div>)}
					{processing.message}
				</div>
				<div>{upload.title} ({upload.filename.split('/').pop()})</div>
				{(upload.description.length > 0) && (<div>{upload.description}</div>)}
				<div className="page-link" onClick={()=> window.open(buildInspectorURL(upload))}>{buildInspectorURL(upload)}</div>
				<CopyToClipboard onCopy={()=> props.onCopyURL()} text={buildInspectorURL(upload)}>
					<button>Copy URL</button>
				</CopyToClipboard>
			</div>

			<InviteTeamForm
				title=""
				profile={profile}
				upload={upload}
				onSubmitted={props.onInviteTeamFormSubmitted}
			/>
		</ContentModal>
	);
};*/

const PartItem = (props)=> {
// 	console.log('InspectorPage.SlicePreviewItem()', props);

	const { id, filename, title, type, size } = props;
	return (<div data-slice-id={id} className="part-item"><Row vertical="center">
		<img src={`${filename}@3x.png`} className="part-item-image" width={size.width * 0.25} height={size.height * 0.25} alt={title} />
		<div className="part-item-title">{`${limitString(title, Math.max(26 - type.length, 1))} (${capitalizeText(type, true)})`}</div>
		<button className="tiny-button part-item-button" onClick={()=> props.onClick()}><FontAwesome name="download" /></button>
	</Row></div>);
};

const PartsList = (props)=> {
// 	console.log('InspectorPage.PartsList()', props);

	const { contents } = props;
	return (<div className="parts-list-wrapper">
		{contents.map((slice, i)=> {
			return (
				<PartItem
					key={i}
					id={slice.id}
					filename={slice.filename}
					title={slice.title}
					type={slice.type}
					size={slice.meta.frame.size}
					onClick={()=> props.onPartItem(slice)}
				/>
			);
		})}
	</div>);
};

const UploadProcessing = (props)=> {
	console.log('InspectorPage.UploadProcessing()', props);

	const { upload, processing } = props;
	const artboard = buildUploadArtboards(upload).pop();

	return (<div className="upload-processing-wrapper"><Column horizontal="center" vertical="start">
		{(processing.message.length > 0) && (<div className="upload-processing-title">{processing.message}</div>)}
		<div className="upload-processing-url">{buildInspectorURL(upload)}</div>

		<div className="upload-processing-button-wrapper">
			<CopyToClipboard onCopy={()=> props.onCopyURL()} text={buildInspectorURL(upload)}>
				<button className="adjacent-button">Copy</button>
			</CopyToClipboard>
			<button onClick={()=> props.onCancel()}>Cancel</button>
		</div>

		{(artboard)
			? (<img className="upload-processing-image" src={(!artboard.filename.includes('@')) ? `${artboard.filename}@0.25x.png` : artboard.filename} alt={upload.title} />)
			: (<img className="upload-processing-image" src={bannerPanel.image} alt={bannerPanel.title} />)
		}
	</Column></div>);
};

const SliceRolloverItem = (props)=> {
// 	console.log('InspectorPage.SliceRolloverItem()', props);

	const { id, artboardID, type, offset, top, left, width, height, scale, visible, filled } = props;

	const className = `slice-rollover-item slice-rollover-item-${type}`;
	const style = {
		top     : `${top}px`,
		left    : `${left}px`,
		width   : `${width}px`,
		height  : `${height}px`,
		zoom    : scale,
// 		transform : `scale(${scale})`,
		display : (visible) ? 'block' : 'none'
	};

	return (<div
		data-slice-id={id}
		data-artboard-id={artboardID}
		className={`${className}${(filled) ? '-filled' : ''}`}
		style={style}
		onMouseEnter={()=> props.onRollOver(offset)}
		onMouseLeave={()=> props.onRollOut()}
		onClick={()=> props.onClick(offset)}>
		{/*<div data-slice-id={id} data-artboard-id={artboardID} className={`slice-rollover-item-caption${(!filled) ? ' is-hidden' : ''}`}>{type}</div>*/}
	</div>);
};

function SpecsList(props) {
// 	console.log('InspectorPage.SpecsList()', props);

	const { upload, slice, creatorID } = props;

	const fillColor = ((slice) ? (slice.type === 'textfield' && slice.meta.font.color) ? slice.meta.font.color : slice.meta.fillColor : '').toUpperCase();
	const padding = (slice) ?`${slice.meta.padding.top}px ${slice.meta.padding.left}px ${slice.meta.padding.bottom}px ${slice.meta.padding.right}px` : null;
	const added = (upload) ? (slice) ? `${slice.added.replace(' ', 'T')}Z` : `${upload.added.replace(' ', 'T')}Z` : '';
	const font = (slice && slice.meta.font) ? fontSpecs(slice.meta.font) : null;
	const sliceStyles = (slice && slice.meta.styles) ? slice.meta.styles : null;
	const border = (sliceStyles && sliceStyles.border) ? sliceStyles.border : null;
	const shadow = (sliceStyles && sliceStyles.shadow) ? sliceStyles.shadow : null;
	const innerShadow = (sliceStyles && sliceStyles.innerShadow) ? sliceStyles.innerShadow : null;

	const styles = (sliceStyles) ? {
		border : (border) ? {
			color     : border.color.toUpperCase(),
			position  : capitalizeText(border.position, true),
			thickness : `${border.thickness}px`
		} : null,
		shadow : (shadow) ? {
			color  : shadow.color.toUpperCase(),
			offset : {
				x : shadow.offset.x,
				y : shadow.offset.y
			},
			spread : `${shadow.spread}px`,
			blur   : `${shadow.blur}px`
		} : null,
		innerShadow : (innerShadow) ? {
			color  : innerShadow.color.toUpperCase(),
			offset : {
				x : innerShadow.offset.x,
				y : innerShadow.offset.y
			},
			spread : `${innerShadow.spread}px`,
			blur   : `${innerShadow.blur}px`
		} : null
	} : null;

	return (
		<div className="inspector-page-specs-list-wrapper">
			<Row><div className="inspector-page-specs-list-attribute">Name</div>{(slice) && (<div className="inspector-page-specs-list-val">{slice.title}</div>)}</Row>
			<Row><div className="inspector-page-specs-list-attribute">Type</div>{(slice) && (<div className="inspector-page-specs-list-val">{capitalizeText(slice.type, true)}</div>)}</Row>
			<Row><div className="inspector-page-specs-list-attribute">Export Size</div>{(slice) && (<div className="inspector-page-specs-list-val">{`W: ${slice.meta.frame.size.width}px H: ${slice.meta.frame.size.height}px`}</div>)}</Row>
			<Row><div className="inspector-page-specs-list-attribute">Position</div>{(slice) && (<div className="inspector-page-specs-list-val">{`X: ${slice.meta.frame.origin.x}px Y: ${slice.meta.frame.origin.y}px`}</div>)}</Row>
			<Row><div className="inspector-page-specs-list-attribute">Rotation</div>{(slice) && (<div className="inspector-page-specs-list-val">{slice.meta.rotation}&deg;</div>)}</Row>
			<Row><div className="inspector-page-specs-list-attribute">Opacity</div>{(slice) && (<div className="inspector-page-specs-list-val">{slice.meta.opacity * 100}%</div>)}</Row>
			<Row><div className="inspector-page-specs-list-attribute">Fill</div>{(fillColor.length > 0) && (<div className="inspector-page-specs-list-val"><Row vertical="center">{fillColor}<ColorSwatch fill={fillColor} /></Row></div>)}</Row>
			<Row><div className="inspector-page-specs-list-attribute">Border</div>{(border) && (<div className="inspector-page-specs-list-val"><Row vertical="center">{`${styles.border.position} S: ${styles.border.thickness} ${styles.border.color}`}<ColorSwatch fill={styles.border.color} /></Row></div>)}</Row>
			<Row><div className="inspector-page-specs-list-attribute">Shadow</div>{(shadow) && (<div className="inspector-page-specs-list-val"><Row vertical="center">{`X: ${styles.shadow.offset.x} Y: ${styles.shadow.offset.y} B: ${styles.shadow.blur} S: ${styles.shadow.spread}`}<ColorSwatch fill={styles.shadow.color} /></Row></div>)}</Row>
			<Row><div className="inspector-page-specs-list-attribute">Inner Shadow</div>{(innerShadow) && (<div className="inspector-page-specs-list-val"><Row vertical="center">{`X: ${styles.innerShadow.offset.x} Y: ${styles.innerShadow.offset.y} B: ${styles.innerShadow.blur} S: ${styles.shadow.spread}`}<ColorSwatch fill={styles.innerShadow.color} /></Row></div>)}</Row>
			{(slice && slice.type === 'textfield') && (<>
				<Row><div className="inspector-page-specs-list-attribute">Font</div><div className="inspector-page-specs-list-val">{`${font.family} ${font.name}`}</div></Row>
				<Row><div className="inspector-page-specs-list-attribute">Font Weight</div><div className="inspector-page-specs-list-val">{font.weight}</div></Row>
				<Row><div className="inspector-page-specs-list-attribute">Font Size</div><div className="inspector-page-specs-list-val">{`${font.size}px`}</div></Row>
				<Row><div className="inspector-page-specs-list-attribute">Font Color</div><div className="inspector-page-specs-list-val"><Row vertical="center">{(font.color) ? font.color.toUpperCase() : ''}<ColorSwatch fill={font.color} /></Row></div></Row>
				<Row><div className="inspector-page-specs-list-attribute">Alignment</div><div className="inspector-page-specs-list-val">{(slice.meta.font.alignment) ? capitalizeText(slice.meta.font.alignment) : 'Left'}</div></Row>
				<Row><div className="inspector-page-specs-list-attribute">Line Spacing</div>{(font.lineHeight) && (<div className="inspector-page-specs-list-val">{`${font.lineHeight}px`}</div>)}</Row>
				<Row><div className="inspector-page-specs-list-attribute">Char Spacing</div>{(font.kerning) && (<div className="inspector-page-specs-list-val">{`${font.kerning.toFixed(2)}px`}</div>)}</Row>
			</>)}
			<Row><div className="inspector-page-specs-list-attribute">Padding</div>{(padding) && (<div className="inspector-page-specs-list-val">{padding}</div>)}</Row>
			<Row><div className="inspector-page-specs-list-attribute">Blend Mode</div>{(slice) && (<div className="inspector-page-specs-list-val">{capitalizeText(slice.meta.blendMode, true)}</div>)}</Row>
			<Row><div className="inspector-page-specs-list-attribute">Date</div>{(added) && (<div className="inspector-page-specs-list-val"><Moment format={MOMENT_TIMESTAMP}>{added}</Moment></div>)}</Row>
			<Row><div className="inspector-page-specs-list-attribute">Uploader</div>{(upload) && (<div className="inspector-page-specs-list-val">{upload.creator.username + ((creatorID === upload.creator.user_id) ? ' (You)' : '')}</div>)}</Row>
		</div>
	);
}


class InspectorPage extends Component {
	constructor(props) {
		super(props);

		this.state = {
			section      : window.location.pathname.substr(1).split('/').shift(),
			upload       : null,
			artboard     : null,
			slice        : null,
			hoverSlice   : null,
			offset       : null,
			hoverOffset  : null,
			selectedTab  : 0,
			tabs         : [],
			scale        : 0.25,
			panCoords    : {
				x : 0.5,
				y : 0.5,
			},
			viewport     : {
				width  : 0,
				height : 0
			},
			scrollOffset : {
				x : 0,
				y : 0
			},
			restricted   : false,
			shareModal   : false,
			urlBanner    : true,
			scrolling    : false,
			tutorial     : null,
			code         : {
				html   : '',
				syntax : ''
			},
			processing   : {
				state   : 0,
				message : ''
			},
			tooltip      : ''
		};

		this.initialScaled = false;
		this.processingInterval = null;
		this.antsOffset = 0;
		this.canvasInterval = null;
		this.scrollTimeout = null;
		this.notification = null;
	}

	componentDidMount() {
		console.log('InspectorPage.componentDidMount()', this.props, this.state);

		if (this.props.redirectURI) {
			this.props.setRedirectURI(null);
		}

		const { deeplink } = this.props;
		if (deeplink.uploadID !== 0) {
			this.onRefreshUpload();
		}

		document.addEventListener('keydown', this.handleKeyDown.bind(this));
		document.addEventListener('wheel', this.handleWheelStart.bind(this));
	}

	shouldComponentUpdate(nextProps, nextState, nextContext) {
// 		console.log('InspectorPage.shouldComponentUpdate()', this.props, nextProps, this.state, nextState, nextContext);

		const { upload, restricted } = nextState;
		if (upload && upload.private === '1' ) {
			const isOwner = (nextProps.profile && upload.creator.user_id === nextProps.profile.id);
			const isContributor = (nextProps.profile && !isOwner && (upload.contributors.filter((contributor)=> (contributor.id === nextProps.profile.id)).length > 0));

			if (!restricted && (!isOwner && !isContributor)) {
				this.setState({
					restricted : true,
					tooltip    : ''
				});
			}
		}

		return (true);
	}

	componentDidUpdate(prevProps, prevState, snapshot) {
// 		console.log('InspectorPage.componentDidUpdate()', prevProps, this.props, this.state);

		const { deeplink, processing } = this.props;
		const { upload, viewport } = this.state;

		if (deeplink && deeplink !== prevProps.deeplink && deeplink.uploadID !== 0) {
			this.onRefreshUpload();
		}

		if (upload && processing && this.processingInterval === null) {
			this.setState({
				processing : {
					state   : 0,
					message : ``
				}
			});

			this.processingInterval = setInterval(()=> this.onProcessingUpdate(), STATUS_INTERVAL);
			this.onProcessingUpdate();
		}

		if (!processing && this.processingInterval) {
			clearInterval(this.processingInterval);
			this.processingInterval = null;
			this.onRefreshUpload();
		}

		if (artboardsWrapper.current && (viewport.width !== artboardsWrapper.current.clientWidth || viewport.height !== artboardsWrapper.current.clientHeight)) {
			this.setState({
				viewport     : {
					width  : artboardsWrapper.current.clientWidth,
					height : artboardsWrapper.current.clientHeight
				}
			});

			if (canvasWrapper.current) {
				const scale = Math.min(Math.max(Math.min(canvasWrapper.current.clientWidth / (artboardsWrapper.current.clientWidth - canvasWrapper.current.clientWidth), canvasWrapper.current.clientHeight / (artboardsWrapper.current.clientHeight - canvasWrapper.current.clientHeight)), 0.25), 3);
				if (this.state.scale !== scale && !this.initialScaled) {
					this.initialScaled = true;
					this.setState({ scale });
				}
			}
		}

		if (upload && canvasWrapper.current) {
			if (!this.state.tutorial && cookie.load('tutorial') === '0') {
				cookie.save('tutorial', '1', { path : '/' });

				let artboard =buildUploadArtboards(upload).pop();
				artboard.meta = JSON.parse(artboard.meta);
				const tutorial = {
					origin : {
						top  : `${62 + ARTBOARD_ORIGIN.y}px`,
						left : `${5 + ARTBOARD_ORIGIN.x}px`
					}
				};

				this.setState({ tutorial });
			}
		}
	}

	componentWillUnmount() {
		console.log('InspectorPage.componentWillUnmount()', this.state);

		clearInterval(this.processingInterval);
		clearInterval(this.canvasInterval);
		clearTimeout(this.scrollTimeout);

		this.processingInterval = null;
		this.canvasInterval = null;
		this.scrollTimeout = null;

		document.removeEventListener('keydown', this.handleKeyDown.bind(this));
		document.removeEventListener('wheel', this.handleWheelStart.bind(this));

		const { section, upload } = this.state;
		if (upload) {
			this.props.setRedirectURI(buildInspectorPath(upload), section);
		}
	}


	canvasSliceFrame = (slice, artboard, offset, scrollOffset)=> {
		console.log('InspectorPage.canvasSliceFrame()', slice, artboard, offset, scrollOffset);

		const { scale } = this.state;
		const srcFrame = cropFrame(slice.meta.frame, artboard.meta.frame);
		const srcOffset = {
			x : (offset.x - (scrollOffset.x - ARTBOARD_ORIGIN.x)) << 0,
			y : (offset.y - (scrollOffset.y - ARTBOARD_ORIGIN.y)) << 0
		};

		return ({
			origin : {
				x : (srcOffset.x + (srcFrame.origin.x * scale)) << 0,
				y : (srcOffset.y + (srcFrame.origin.y * scale)) << 0

			},
			size   : {
				width  : (srcFrame.size.width * scale) << 0,
				height : (srcFrame.size.height * scale) << 0
			}
		});
	};


	handleArtboardRollOut = (event)=> {
// 		console.log('InspectorPage.handleArtboardRollOut()', event.target);

		const { artboard, slice } = this.state;
		artboard.slices.filter((item)=> (slice && slice.id !== item.id)).forEach((item)=> {
			item.filled = false;
		});

		this.setState({
			artboard    : (slice) ? artboard : null,
			hoverSlice  : null,
			hoverOffset : null
		});
	};

	handleArtboardRollOver = (event)=> {
		console.log('InspectorPage.handleArtboardRollOver()', event.target);

// 		event.stopPropagation();
		const artboardID = event.target.getAttribute('data-artboard-id');

		if (artboardID) {
			let { upload, artboard } = this.state;
			if (!artboard || artboard.id !== artboardID) {
				artboard = artboardByID(upload, artboardID);
				if (artboard) {
					this.setState({ artboard });
				}
			}

			if (!this.canvasInterval) {
				this.canvasInterval = setInterval(()=> this.onCanvasInterval(), MARCHING_ANTS.INTERVAL);
			}

			if (artboard.slices.length === 0) {
				let formData = new FormData();
				formData.append('action', 'SLICES');
				formData.append('artboard_id', artboardID);
				axios.post('https://api.designengine.ai/system.php', formData)
					.then((response) => {
// 						console.log('SLICES', response.data);

						let { upload } = this.state;
						let pages = [...upload.pages];
						pages.forEach((page) => {
							page.artboards.filter((artboard)=> (artboard.id === artboardID)).forEach((artboard)=> {
								artboard.slices = response.data.slices.map((item)=> ({
									id         : item.id,
									artboardID : item.artboard_id,
									title      : item.title,
									type       : item.type,
									filename   : item.filename,
									meta       : JSON.parse(item.meta),
									added      : item.added,
									filled     : false
								}));
							});
						});

						upload.pages = pages;
						this.setState({ upload });
					}).catch((error)=> {
				});
			}
		}
	};

	handleCanvasClick = (event)=> {
		console.log('InspectorPage.handleCanvasClick()', event.target);

		event.stopPropagation();
		this.setState({
			slice : null
		});
	};

	handleCanvasUpdate = ()=> {
// 		console.log('InspectorPage.handleCanvasUpdate()', this.antsOffset);

		const { scrollOffset, offset, hoverOffset } = this.state;
		const { artboard, slice, hoverSlice } = this.state;

		const context = canvas.current.getContext('2d');
		context.clearRect(0, 0, canvas.current.clientWidth, canvas.current.clientHeight);

		context.font = CANVAS_CAPTION.fontFace;
		context.textAlign = CANVAS_CAPTION.align;
		context.textBaseline = CANVAS_CAPTION.baseline;

		// debug fill 100%
// 		context.fillStyle = 'rgba(0, 0, 0, 0.25)';
// 		context.fillRect(0, 0, canvas.current.clientWidth, canvas.current.clientHeight);


		if (artboard) {
			if (slice) {
				const frame = this.canvasSliceFrame(slice, artboard, offset, scrollOffset);
				drawSliceFill(context, frame, CANVAS_COLORS.types[slice.type].fill);
				drawSliceCaption(context, slice.type, frame.origin);
				drawSliceBorder(context, frame);
				drawSliceGuides(context, frame, { width : canvas.current.clientWidth, height : canvas.current.clientHeight }, CANVAS_COLORS.types[slice.type].guides);
				drawSliceMarchingAnts(context, frame, this.antsOffset);
			}

			if (hoverSlice) {
				if (!slice || (slice && slice.id !== hoverSlice.id)) {
					const frame = this.canvasSliceFrame(hoverSlice, artboard, hoverOffset, scrollOffset);
					drawSliceFill(context, frame, CANVAS_COLORS.types[hoverSlice.type].fill);
					drawSliceCaption(context, hoverSlice.type, frame.origin);
					drawSliceBorder(context, frame);
				}
			}
		}
	};

	handleCloseNotification = (event)=> {
// 		console.log('InspectorPage.handleCloseNotification()', event, this.notification);
		window.focus();
		trackEvent('notification', 'close');
		this.notification.close(event.target.tag);
	};

	handleCopyCode = ()=> {
		console.log('InspectorPage.handleCopyCode()');

		trackEvent('button', 'copy-code');
		this.props.onPopup({
			type    : POPUP_TYPE_INFO,
			content : 'Copied to Clipboard!'
		});
	};

	handleCopyURL = ()=> {
		console.log('InspectorPage.handleCopyURL()');

		trackEvent('button', 'copy-url');
		this.props.onPopup({
			type    : POPUP_TYPE_INFO,
			content : 'Copied to Clipboard!'
		});
	};

	handleDownloadAll = ()=> {
		console.log('InspectorPage.handleDownloadAll()');

		trackEvent('button', 'download-project');
		const { upload } = this.state;
		makeDownload(`http://cdn.designengine.ai/download-project.php?upload_id=${upload.id}`);
	};

	handleDownloadPartItem = (slice)=> {
// 		console.log('InspectorPage.handleDownloadPartItem()', slice);

		trackEvent('button', 'download-part');
		const { upload } = this.state;
		makeDownload(`http://cdn.designengine.ai/download-slices.php?upload_id=${upload.id}&slice_title=${slice.title}&slice_ids=${[slice.id]}`);
	};

	handleDownloadPartsList = ()=> {
// 		console.log('InspectorPage.handleDownloadPartsList()');

		trackEvent('button', 'download-list');
		const { upload, slice } = this.state;
		const sliceIDs = buildSlicePreviews(upload, slice).map((slice)=> (slice.id)).join(',');
		makeDownload(`http://cdn.designengine.ai/download-slices.php?upload_id=${upload.id}&slice_title=${slice.title}&slice_ids=${sliceIDs}`);
	};

	handleInviteTeamFormSubmitted = (result)=> {
		console.log('InspectorPage.handleInviteTeamFormSubmitted()', result);

		this.props.onPopup({
			type    : POPUP_TYPE_INFO,
			content : `Sent ${result.sent.length} invite${(result.sent.length === 1) ? '' : 's'}!`
		});
	};

	handleInviteModalClose = ()=> {
		const { processing } = this.state;
		this.setState({
			processing : {
				state : processing.state,
				message : ''
			},
			shareModal : false
		});
	};

	handleKeyDown = (event)=> {
// 		console.log('InspectorPage.handleKeyDown()', event);

		trackEvent('keypress', (event.keyCode === PLUS_KEY) ? 'plus' : 'minus');
		if (event.keyCode === PLUS_KEY) {
			this.handleZoom(1);

		} else if (event.keyCode === MINUS_KEY) {
			this.handleZoom(-1);
		}
	};

	handleSliceClick = (ind, slice, offset)=> {
		console.log('InspectorPage.handleSliceClick()', ind, slice, offset);

		trackEvent('slice', `${slice.id}_${convertURISlug(slice.title)}`);

		const { upload, artboard, section } = this.state;
		let { tabs } = this.state;

// 		buildUploadArtboards(upload).filter((artboard)=> (artboard.id === slice.artboardID)).forEach((artboard)=> {
// 			artboard.slices.filter((item)=> (!item.id === slice.id)).forEach((item)=> {
// 				item.filled = true;
// 			});
// 		});


		artboard.slices.filter((item)=> (item.id !== slice.id)).forEach((item)=> {
			item.filled = false;
		});

		slice.filled = true;

		const css = toCSS(slice);
		const reactCSS = toReactCSS(slice);
		const swift = toSwift(slice, artboardByID(upload, slice.artboardID));

		if (section === 'inspect') {
			tabs[0].contents = css.html;
			tabs[0].syntax = css.syntax;
			tabs[1].contents = reactCSS.html;
			tabs[1].syntax = reactCSS.syntax;
			tabs[2].contents = swift.html;
			tabs[2].syntax = swift.syntax;

		} else if (section === 'parts') {
			tabs[0].contents = buildSlicePreviews(upload, slice);
		}

		this.setState({
			tabs        : tabs,
			artboard    : artboard,
			slice       : slice,
			offset      : offset,
			hoverSlice  : null,
			hoverOffset : null
		});
	};

	handleSliceRollOut = (ind, slice)=> {
		console.log('InspectorPage.handleSliceRollOut()', ind, slice, this.state);

		const { upload, artboard, section } = this.state;
		let { tabs } = this.state;

// 		slice.filled = (this.state.slice && this.state.slice.id === slice.id);

// 		buildUploadArtboards(upload).filter((artboard)=> (artboard.id === slice.artboardID)).forEach((artboard)=> {
// 			artboard.slices.filter((item)=> (item.filled)).forEach((item)=> {
// 				if (!this.state.slice) {
// 					item.filled = false;
//
// 				} else {
// 					item.filled = (item.id !== this.state.slice.id);
// 				}
// 			});
// 		});

// 		const pages = [...upload.pages];
// 		pages.forEach((page)=> {
// 			page.artboards.filter((artboard)=> (artboard.id === slice.artboardID)).forEach((artboard)=> {
// 				artboard.slices.filter((item)=> (item.filled)).forEach((item)=> {
// 					item.filled = false;
// 				});
// 			});
// 		});
//
// 		upload.pages = pages;

		if (this.state.slice) {
// 			buildUploadArtboards(upload).filter((artboard)=> (artboard.id === this.state.slice.artboardID)).forEach((artboard)=> {
// 				artboard.slices.filter((item)=> (item.id !== this.state.slice.id)).forEach((item)=> {
// 					item.filled = false;
// 				});
// 			});

// 			const pages = [...upload.pages];
// 			pages.forEach((page)=> {
// 				page.artboards.filter((artboard)=> (artboard.id === this.state.slice.artboardID)).forEach((item)=> {
// 					item.slices.filter((itm)=> (itm.id !== this.state.slice.id)).forEach((itm)=> {
// 						itm.filled = false;
// 					});
// 				});
// 			});

			const css = toCSS(this.state.slice);
			const reactCSS = toReactCSS(this.state.slice);
			const swift = toSwift(this.state.slice, artboardByID(upload, this.state.slice.artboardID));

			if (section === 'inspect') {
				tabs[0].contents = css.html;
				tabs[0].syntax = css.syntax;
				tabs[1].contents = reactCSS.html;
				tabs[1].syntax = reactCSS.syntax;
				tabs[2].contents = swift.html;
				tabs[2].syntax = swift.syntax;

			} else if (section === 'parts') {
				tabs[0].contents = buildSlicePreviews(upload, this.state.slice);
			}

		} else {
			artboard.slices.forEach((item)=> {
				item.filled = false;
			});
		}

		this.setState({
// 			upload     : upload,
			artboard    : artboard,
			tabs        : tabs,
			hoverSlice  : null,
			hoverOffset : null
		});
	};

	handleSliceRollOver = (ind, slice, offset)=> {
// 		console.log('InspectorPage.handleSliceRollOver()', ind, slice, offset);

		const { upload, artboard, section } = this.state;
		let { tabs } = this.state;

// 		const pages = [...upload.pages];
// 		pages.forEach((page)=> {
// 			page.artboards.filter((artboard)=> (artboard.id === slice.artboardID)).forEach((item)=> {
// 				item.slices.filter((itm)=> (itm.id === slice.id)).forEach((itm)=> {
// 					//itm.filled = rectContainsRect(frameToRect(slice.meta.frame), frameToRect(itm.meta.frame));
// 					itm.filled = true;
// 				});
// 			});
// 		});
//
// 		upload.pages = pages;

		artboard.slices.filter((item)=> (this.state.slice && this.state.slice.id !== item.id)).forEach((item)=> {
			item.filled = false;
		});

		slice.filled = true;

		const css = toCSS(slice);
		const reactCSS = toReactCSS(slice);
		const swift = toSwift(slice, artboardByID(upload, slice.artboardID));

		if (section === 'inspect') {
			tabs[0].contents = css.html;
			tabs[0].syntax = css.syntax;
			tabs[1].contents = reactCSS.html;
			tabs[1].syntax = reactCSS.syntax;
			tabs[2].contents = swift.html;
			tabs[2].syntax = swift.syntax;

		} else if (section === 'parts') {
			tabs[0].contents = buildSlicePreviews(upload, slice);
		}

		this.setState({
// 			upload      : upload,
			artboard    : artboard,
			tabs        : tabs,
			hoverSlice  : slice,
			hoverOffset : offset
		});
	};

	handleTab = (tab)=> {
// 		 console.log('InspectorPage.handleTab()', tab);
		const { tabs } = this.state;
		trackEvent('tab', convertURISlug(tab.title));
		this.setState({ selectedTab : tabs.indexOf(tab) });
	};

	handleTutorialNextStep = (step)=> {
		console.log('InspectorPage.handleTutorialNextStep()', step);
		const tutorial = {
			origin : {
				top  : (step === 1) ? '240px' : '140px',
				left : (step === 1) ? `${artboardsWrapper.current.clientWidth - 250}px` : '50%',
			}
		};

		this.setState({ tutorial : tutorial });
	};

	handleUploadProcessingCancel = ()=> {
		console.log('InspectorPage.handleUploadProcessingCancel()');

		if (this.processingInterval) {
			clearInterval(this.processingInterval);
			this.processingInterval = null;
		}
		this.props.onProcessing(false);
		this.onRefreshUpload();
	};


	handleWheelStart = (event)=> {
// 		console.log('InspectorPage.handleWheelStart()', event.type, event.deltaX, event.deltaY, event.target);
		//console.log('wheel', artboardsWrapper.current.clientWidth, artboardsWrapper.current.clientHeight, artboardsWrapper.current.scrollTop, artboardsWrapper.current.scrollLeft);

		event.stopPropagation();

		clearTimeout(this.scrollTimeout);
		this.scrollTimeout = null;

		if (event.ctrlKey) {
			event.preventDefault();
			this.setState({
				scrolling : true,
				scale     : Math.min(Math.max(this.state.scale - (event.deltaY * PAN_FACTOR), 0.03), 3).toFixed(2),
				tooltip   : `${(Math.min(Math.max(this.state.scale - (event.deltaY * PAN_FACTOR), 0.03), 3).toFixed(2) * 100) << 0}%`
			});

		} else {
			if (artboardsWrapper.current) {
				this.setState({
					scrolling    : true,
					scrollOffset : {
						x : artboardsWrapper.current.scrollLeft,
						y : artboardsWrapper.current.scrollTop
					}
				});
			}
		}

		this.scrollTimeout = setTimeout(()=> this.onWheelTimeout(), 50);
	};

	handleZoom = (direction)=> {
// 		console.log('InspectorPage.handleZoom()', direction);

		const { scale } = this.state;

		if (direction === 0) {
			artboardsWrapper.current.scrollTo(0, 0);
			this.setState({
				scrollOffset : {
					x : 0,
					y : 0
				},
				scale        : ZOOM_NOTCHES[3],
				tooltip      : `${(ZOOM_NOTCHES[3] * 100) << 0}%`
			});

		} else {
			let ind = -1;
			ZOOM_NOTCHES.forEach((amt, i)=> {
				if (amt === scale) {
					ind = i + direction;
				}
			});

			ZOOM_NOTCHES.forEach((amt, i)=> {
				if (ind === -1) {
					if (direction > 0) {
						if (amt > scale) {
							ind = i;
						}

					} else {
						if (amt > scale) {
							ind = i - 1;
						}
					}
				}
			});

			this.setState({
				scale   : ZOOM_NOTCHES[Math.min(Math.max(0, ind + direction), ZOOM_NOTCHES.length - 1)],
				tooltip : `${(ZOOM_NOTCHES[Math.min(Math.max(0, ind + direction), ZOOM_NOTCHES.length - 1)] * 100) << 0}%`
			});
		}

		setTimeout(()=> {
			this.setState({ tooltip : '' });
		}, 1000);
	};

	onCanvasInterval = ()=> {
		if (canvas.current) {
			this.antsOffset = ((this.antsOffset + MARCHING_ANTS.INCREMENT) % MARCHING_ANTS.OFFSET_MOD);
			this.handleCanvasUpdate();
		}
	};

	onProcessingUpdate = ()=> {
		console.log('InspectorPage.onProcessingUpdate()');

		const { upload } = this.state;

		let formData = new FormData();
		formData.append('action', 'UPLOAD_STATUS');
		formData.append('upload_id', upload.id);
		axios.post('https://api.designengine.ai/system.php', formData)
			.then((response)=> {
				console.log('UPLOAD_STATUS', response.data);
				const { status } = response.data;
				const processingState = parseInt(status.state, 10);
				const ellipsis = Array(((((new Date()).getTime() * 0.001) << 0) % 4) + 1).join('.');

				if (processingState === 0) {
					const { queue } = status;
					this.setState({
						processing : {
							state   : processingState,
							message : `Queued position ${queue.position}/${queue.total}, please wait${ellipsis}`
						}
					});

				} else if (processingState === 1) {
					this.setState({
						processing : {
							state   : processingState,
							message : `Preparing "${limitString(upload.filename.split('/').pop(), 27, '')}"${ellipsis}`
						}
					});

				} else if (processingState === 2) {
// 					const { totals } = status;
// 					const total = Object.values(totals).reduce((acc, val)=> (parseInt(acc, 10) + parseInt(val, 10)));

// 					const mins = moment.duration(moment(Date.now()).diff(`${status.started.replace(' ', 'T')}Z`)).asMinutes();
// 					const secs = ((mins - (mins << 0)) * 60) << 0;

					this.setState({
						processing : {
							state   : processingState,
// 							message : `Processing ${upload.filename.split('/').pop()}, parsed ${total} element${(total === 1) ? '' : 's'} in ${(mins >= 1) ? (mins << 0) + 'm' : ''} ${secs}s…`
							message : `Processing "${limitString(upload.filename.split('/').pop(), 27, '')}"${ellipsis}`
						}
					});
					this.onRefreshUpload();

				} else if (processingState === 3) {
					clearInterval(this.processingInterval);
					this.processingInterval = null;

					const { totals } = status;
					const total = Object.values(totals).reduce((acc, val)=> (parseInt(acc, 10) + parseInt(val, 10)));

					const mins = moment.duration(moment(`${status.ended.replace(' ', 'T')}Z`).diff(`${status.started.replace(' ', 'T')}Z`)).asMinutes();
					const secs = ((mins - (mins << 0)) * 60) << 0;

					this.onShowNotification();

					this.setState({
						processing : {
							state   : processingState,
// 							message : `Completed processing. Parsed ${total} element${(total === 1) ? '' : 's'} in ${(mins >= 1) ? (mins << 0) + 'm' : ''} ${secs}s.`
							message : `Completed processing ${total} element${(total === 1) ? '' : 's'} in ${(mins >= 1) ? (mins << 0) + 'm' : ''} ${secs}s.`
						}
					});

					this.props.onProcessing(false);

				} else if (processingState === 4) {
					this.setState({
						processing : {
							state   : processingState,
							message : 'An error has occurred during processing!'
						}
					});
				}
			}).catch((error)=> {
		});
	};

	onRefreshUpload = ()=> {
		console.log('InspectorPage.onRefreshUpload()', this.props);

		const { uploadID } = this.props.deeplink;
// 		const { section, scale, viewport } = this.state;
		const { section } = this.state;

		this.setState({ tooltip : 'Loading…' });

// 		let maxH = 0;
// 		let offset = {
// 			x : 0,
// 			y : 0
// 		};

		axios.post('https://api.designengine.ai/system.php', qs.stringify({
			action    : 'UPLOAD',
			upload_id : uploadID
		})).then((response)=> {
			console.log('UPLOAD', response.data);

			let { upload } = response.data;
// 			upload.pages = upload.pages.map((page)=> {
// 				page.artboards = page.artboards.map((artboard, i, arr)=> {
// 					if ((i % 5) << 0 === 0 && i !== 0) {
// 						viewport.height += maxH + 50;
// 						offset.x = 0;
// 						offset.y += 50 + maxH;
// 						maxH = 0;
// 					}
//
// 					maxH = Math.round(Math.max(maxH, JSON.parse(artboard.meta).frame.size.height * scale));
//
// 					if (i > 0 && i < arr.length - 1) {
// 						offset.x += Math.round(50 + (JSON.parse(artboard.meta).frame.size.width * scale)) - (0);
// 					}
//
// 					viewport.width = Math.max(viewport.width, offset.x);
//
// 					return ({
// 						id        : artboard.id,
// 						pageID    : artboard.page_id,
// 						title     : artboard.title,
// 						filename  : (artboard.filename.includes('@3x')) ? artboard.filename : `${artboard.filename}@3x.png`,
// 						meta      : JSON.parse(artboard.meta),
// 						added     : artboard.added,
// 						grid      : {
// 							col : i % 5,
// 							row : (i / 5) << 0
// 						},
// 						offset    : {
// 							x : offset.x,
// 							y : offset.y
// 						},
// 						slices    : artboard.slices.map((item)=> ({
// 							id       : item.id,
// 							title    : item.title,
// 							type     : item.type,
// 							filename : item.filename,
// 							meta     : JSON.parse(item.meta),
// 							added    : item.added
// 						}))
// 					});
// 				});
//
// 				return (page);
// 			});


			const tabs = inspectorTabs[section];
			const tooltip = '';
			this.setState({ upload, tabs, tooltip });


			const processing = (parseInt(upload.state, 10) < 3);
			if (processing && !this.props.processing && !this.processingInterval) {
				this.props.onProcessing(true);
			}
// 			if (this.props.processing !== processing) {
// 				this.props.onProcessing(processing);
// 			}
		}).catch((error)=> {
		});
	};

	onShowNotification = ()=> {
		console.log('InspectorPage.onShowNotification()', this.notification);
		if (this.notification.supported()) {
			this.notification.show();
		}
	};

	onWheelTimeout = ()=> {
// 		console.log('InspectorPage.onWheelTimeout()');

		clearTimeout(this.scrollTimeout);
		this.scrollTimeout = null;

		this.setState({ scrolling : false });
	};


	render() {
		const { processing, profile } = this.props;

		const { section, upload, slice, hoverSlice, tabs, scale, selectedTab, scrolling, viewport, scrollOffset } = this.state;
		const { restricted, urlBanner, tutorial } = this.state;


		const artboards = (upload) ? buildUploadArtboards(upload).reverse() : [];
		const activeSlice = (hoverSlice) ? hoverSlice : slice;

		const urlClass = `inspector-page-url-wrapper${(!urlBanner) ? ' inspector-page-url-outro' : ''}`;

		const artboardsStyle = {
			position  : 'absolute',
			width     : `${viewport.width * scale}px`,
			height    : `${viewport.height * scale}px`,
// 			transform : `translate(${Math.round(pt.x * viewport.width)}px, ${Math.round(pt.y * viewport.height)}px) translate(${Math.round((viewport.width * -0.5) * scale)}px, ${Math.round((viewport.height * -0.5) * scale)}px)`
			transform : `translate(${ARTBOARD_ORIGIN.x}px, ${ARTBOARD_ORIGIN.y}px)`,
			opacity   : (processing) ? '0' : '1'
		};

// 		const canvasStyle = {
// 			top     : `${Math.round(-((pt.y * viewport.height) + ((viewport.height * -0.5) * scale)))}px`,
// 			left    : `${Math.round(-((pt.x * viewport.width) + ((viewport.width * -0.5) * scale)))}px`,
// 			display : (scrolling) ? 'none' : 'block'
// 		};

		const canvasStyle = {
			top     : `${(scrollOffset.y - ARTBOARD_ORIGIN.y)}px`,
			left    : `${(scrollOffset.x - ARTBOARD_ORIGIN.x)}px`,
			display : (scrolling) ? 'none' : 'block'
// 			display : 'block'
		};


		let maxH = 0;
		let offset = {
			x : 0,
			y : 0
		};

		let artboardImages = [];
		let slices = [];

		artboards.forEach((artboard, i)=> {
			artboard.filename = (!artboard.filename.includes('@')) ? `${artboard.filename}@3x.png` : artboard.filename;
			artboard.meta = (typeof artboard.meta === 'string') ? JSON.parse(artboard.meta) : artboard.meta;

			if ((i % 5) << 0 === 0 && i > 0) {
				offset.x = 0;
				offset.y += maxH + 50;
				maxH = 0;
			}

			maxH = Math.round(Math.max(maxH, artboard.meta.frame.size.height * scale));

			const artboardStyle = {
				position       : 'absolute',
				top            : `${offset.y << 0}px`,
				left           : `${offset.x << 0}px`,
				width          : `${(scale * artboard.meta.frame.size.width) << 0}px`,
				height         : `${(scale * artboard.meta.frame.size.height) << 0}px`,
				background     : `#24282e url("${artboard.filename}") no-repeat center`,
				backgroundSize : `${(scale * artboard.meta.frame.size.width) << 0}px ${(scale * artboard.meta.frame.size.height) << 0}px`,
				border         : '1px solid #005cc5'
			};

			const slicesWrapperStyle = {
				position : 'absolute',
				top      : `${offset.y << 0}px`,
				left     : `${offset.x << 0}px`,
				width    : `${(scale * artboard.meta.frame.size.width) << 0}px`,
				height   : `${(scale * artboard.meta.frame.size.height) << 0}px`,
			};

			const groupSlices = artboard.slices.filter((slice)=> (slice.type === 'group')).map((slice, i)=> (
				<SliceRolloverItem
					key={i}
					id={slice.id}
					artboardID={artboard.id}
					title={slice.title}
					type={slice.type}
					filled={slice.filled}
					visible={(!scrolling)}
					top={slice.meta.frame.origin.y}
					left={slice.meta.frame.origin.x}
					width={slice.meta.frame.size.width}
					height={slice.meta.frame.size.height}
					scale={scale}
					offset={{ x : offset.x, y : offset.y }}
					onRollOver={(offset)=> this.handleSliceRollOver(i, slice, offset)}
					onRollOut={()=> this.handleSliceRollOut(i, slice)}
					onClick={(offset)=> this.handleSliceClick(i, slice, offset)} />)
			);

			const backgroundSlices = artboard.slices.filter((slice)=> (slice.type === 'background')).map((slice, i)=> (
				<SliceRolloverItem
					key={i}
					id={slice.id}
					artboardID={artboard.id}
					title={slice.title}
					type={slice.type}
					filled={slice.filled}
					visible={(!scrolling)}
					top={slice.meta.frame.origin.y}
					left={slice.meta.frame.origin.x}
					width={slice.meta.frame.size.width}
					height={slice.meta.frame.size.height}
					scale={scale}
					offset={{ x : offset.x, y : offset.y }}
					onRollOver={(offset)=> this.handleSliceRollOver(i, slice, offset)}
					onRollOut={()=> this.handleSliceRollOut(i, slice)}
					onClick={(offset)=> this.handleSliceClick(i, slice, offset)} />)
			);

			const symbolSlices = artboard.slices.filter((slice)=> (slice.type === 'symbol')).map((slice, i)=> (
				<SliceRolloverItem
					key={i}
					id={slice.id}
					artboardID={artboard.id}
					title={slice.title}
					type={slice.type}
					filled={slice.filled}
					visible={(!scrolling)}
					top={slice.meta.frame.origin.y}
					left={slice.meta.frame.origin.x}
					width={slice.meta.frame.size.width}
					height={slice.meta.frame.size.height}
					scale={scale}
					offset={{ x : offset.x, y : offset.y }}
					onRollOver={(offset)=> this.handleSliceRollOver(i, slice, offset)}
					onRollOut={()=> this.handleSliceRollOut(i, slice)}
					onClick={(offset)=> this.handleSliceClick(i, slice, offset)} />)
			);

			const textfieldSlices = artboard.slices.filter((slice)=> (slice.type === 'textfield')).map((slice, i)=> (
				<SliceRolloverItem
					key={i}
					id={slice.id}
					artboardID={artboard.id}
					title={slice.title}
					type={slice.type}
					filled={slice.filled}
					visible={(!scrolling)}
					top={slice.meta.frame.origin.y}
					left={slice.meta.frame.origin.x}
					width={slice.meta.frame.size.width}
					height={slice.meta.frame.size.height}
					scale={scale}
					offset={{ x : offset.x, y : offset.y }}
					onRollOver={(offset)=> this.handleSliceRollOver(i, slice, offset)}
					onRollOut={()=> this.handleSliceRollOut(i, slice)}
					onClick={(offset)=> this.handleSliceClick(i, slice, offset)} />)
			);

			const sliceSlices = artboard.slices.filter((slice)=> (slice.type === 'slice')).map((slice, i)=> (
				<SliceRolloverItem
					key={i}
					id={slice.id}
					artboardID={artboard.id}
					title={slice.title}
					type={slice.type}
					filled={slice.filled}
					visible={(!scrolling)}
					top={slice.meta.frame.origin.y}
					left={slice.meta.frame.origin.x}
					width={slice.meta.frame.size.width}
					height={slice.meta.frame.size.height}
					scale={scale}
					offset={{ x : offset.x, y : offset.y }}
					onRollOver={(offset)=> this.handleSliceRollOver(i, slice, offset)}
					onRollOut={()=> this.handleSliceRollOut(i, slice)}
					onClick={(offset)=> this.handleSliceClick(i, slice, offset)} />)
			);

			artboardImages.push(
				<div key={i} style={artboardStyle}>
					<div className="inspector-page-artboard-caption">{artboard.title}</div>
				</div>
			);

			slices.push(
				<div key={i} data-artboard-id={artboard.id} className="inspector-page-slices-wrapper" style={slicesWrapperStyle} onMouseOver={this.handleArtboardRollOver} onMouseOut={this.handleArtboardRollOut}>
					<div data-artboard-id={artboard.id} className="inspector-page-group-slices-wrapper">{groupSlices}</div>
					<div data-artboard-id={artboard.id} className="inspector-page-background-slices-wrapper">{backgroundSlices}</div>
					<div data-artboard-id={artboard.id} className="inspector-page-symbol-slices-wrapper">{symbolSlices}</div>
					<div data-artboard-id={artboard.id} className="inspector-page-textfield-slices-wrapper">{textfieldSlices}</div>
					<div data-artboard-id={artboard.id} className="inspector-page-slice-slices-wrapper">{sliceSlices}</div>
				</div>
			);

			offset.x += Math.round(50 + (artboard.meta.frame.size.width * scale));
		});

		artboardImages = (!restricted) ? artboardImages : [];
		slices = (!restricted) ? slices : [];


// 		console.log('InspectorPage.render()', this.state);
// 		console.log('InspectorPage.render()', this.props, this.state);
// 		console.log('InspectorPage:', window.performance.memory);

		return (<>
			<div className="page-wrapper inspector-page-wrapper">
				<div className="inspector-page-content">
					<div className="inspector-page-artboards-wrapper" ref={artboardsWrapper}>
						{(artboards.length > 0) && (<div style={artboardsStyle}>
							{artboardImages}
							<div className="inspector-page-canvas-wrapper" onClick={(event)=> this.handleCanvasClick(event)} style={canvasStyle} ref={canvasWrapper}>
								<canvas width={(artboardsWrapper.current) ? artboardsWrapper.current.clientWidth : 0} height={(artboardsWrapper.current) ? artboardsWrapper.current.clientHeight : 0} ref={canvas}>Your browser does not support the HTML5 canvas tag.</canvas>
							</div>
							{slices}
						</div>)}
					</div>

					{(upload && !processing) && (<div className="inspector-page-footer-wrapper"><Row vertical="center">
						<img src={deLogo} className="inspector-page-footer-logo" alt="Design Engine" />
						<div className="inspector-page-footer-button-wrapper">
							{(profile && (upload.contributors.filter((contributor)=> (contributor.id === profile.id)).length > 0)) && (<button className="adjacent-button" onClick={()=> {trackEvent('button', 'share'); this.setState({ shareModal : true })}}>Share</button>)}
							<button disabled={(scale >= Math.max(...ZOOM_NOTCHES))} className="inspector-page-zoom-button" onClick={()=> {trackEvent('button', 'zoom-in'); this.handleZoom(1)}}><FontAwesome name="search-plus" /></button>
							<button disabled={(scale <= Math.min(...ZOOM_NOTCHES))} className="inspector-page-zoom-button" onClick={()=> {trackEvent('button', 'zoom-out'); this.handleZoom(-1)}}><FontAwesome name="search-minus" /></button>
							<button disabled={(scale === 0.25)} className="inspector-page-zoom-button" onClick={()=> {trackEvent('button', 'zoom-reset'); this.handleZoom(0)}}><FontAwesome name="ban" /></button>
						</div>
					</Row></div>)}
				</div>

				{(section === 'inspect') && (<div className="inspector-page-panel">
					<div className="inspector-page-panel-split-content-wrapper">
						<ul className="inspector-page-panel-tab-wrapper">
							{(tabs.map((tab, i)=> (<li key={i} className={`inspector-page-panel-tab${(selectedTab === i) ? ' inspector-page-panel-tab-selected' : ''}`} onClick={()=> this.handleTab(tab)}>{tab.title}</li>)))}
						</ul>
						<div className="inspector-page-panel-tab-content-wrapper">
							{(tabs.filter((tab, i)=> (i === selectedTab)).map((tab, i)=> {
								return (<div key={i} className="inspector-page-panel-tab-content">
									<span dangerouslySetInnerHTML={{ __html : (tab.contents) ? String(JSON.parse(tab.contents).replace(/ /g, '&nbsp;').replace(/\n/g, '<br />')) : '' }} />
								</div>);
							}))}
						</div>
					</div>
					<div className="inspector-page-panel-button-wrapper">
						<CopyToClipboard onCopy={()=> this.handleCopyCode()} text={(tabs[selectedTab]) ? tabs[selectedTab].syntax : ''}>
							<button className="inspector-page-panel-button">Copy to Clipboard</button>
						</CopyToClipboard>
					</div>
					<div className="inspector-page-panel-split-content-wrapper">
						<ul className="inspector-page-panel-tab-wrapper">
							<li className="inspector-page-panel-tab inspector-page-panel-tab-selected">Specs</li>
							<li className="inspector-page-panel-tab inspector-page-panel-tab-blank" />
						</ul>
						<div className="inspector-page-panel-tab-content-wrapper">
							<div className="inspector-page-panel-tab-content">
								<SpecsList upload={upload} slice={activeSlice} creatorID={(profile) ? profile.id : 0} />
							</div>
						</div>
					</div>
					<div className="inspector-page-panel-button-wrapper">
						<CopyToClipboard onCopy={()=> this.handleCopyCode()} text={(activeSlice) ? toSpecs(activeSlice) : ''}>
							<button className="inspector-page-panel-button">Copy to Clipboard</button>
						</CopyToClipboard>
					</div>
				</div>)}

				{(section === 'parts') && (<div className="inspector-page-panel">
					<div className="inspector-page-panel-full-content-wrapper">
						<ul className="inspector-page-panel-tab-wrapper">
							{(tabs.map((tab, i)=> (<li key={i} className={`inspector-page-panel-tab${(selectedTab === i) ? ' inspector-page-panel-tab-selected' : ''}`} onClick={()=> this.handleTab(tab)}>{tab.title}</li>)))}
						</ul>
						<div className="inspector-page-panel-tab-content-wrapper">
							{(tabs.filter((tab, i)=> (i === selectedTab)).map((tab, i)=> {
								return ((tab.contents)
									? (<PartsList key={i} contents={tab.contents} onPartItem={(slice)=> this.handleDownloadPartItem(slice)} />)
									: ('')
								);
							}))}
						</div>
					</div>
					<div className="inspector-page-panel-button-wrapper">
						<button disabled={tabs.length === 0 || !tabs[0].contents || tabs[0].contents.length === 0} className="inspector-page-panel-button" onClick={()=> this.handleDownloadPartsList()}><FontAwesome name="download" className="inspector-page-download-button-icon" />Download List Parts</button>
						<button disabled={!upload} className="inspector-page-panel-button" onClick={()=> this.handleDownloadAll()}><FontAwesome name="download" className="inspector-page-download-button-icon" />Download Project</button>
					</div>
				</div>)}
			</div>

			{/*{(tooltip !== '' && !processing) && (<div className="inspector-page-tooltip">{tooltip}</div>)}*/}
			{(restricted)
				? (<ContentModal
						tracking="private/inspector"
						closeable={false}
						defaultButton="Register / Login"
						onComplete={()=> this.props.onPage('register')}>
							This project is private, you must be logged in as one of its team members to view!
					</ContentModal>)

				: (<>{(upload && !processing) && (<div className={urlClass}>
						<CopyToClipboard onCopy={()=> this.handleCopyURL()} text={buildInspectorURL(upload)}>
							<div className="inspector-page-url">{buildInspectorURL(upload)}</div>
						</CopyToClipboard>
						<FontAwesome name="times" className="inspector-page-url-close-button" onClick={()=> this.setState({ urlBanner : false })} />
					</div>)}</>)
			}


			{/*{(upload && profile && (upload.contributors.filter((contributor)=> (contributor.id === profile.id)).length > 0)) && (<UploadProcessing*/}
			{(upload && profile && (processing && upload.contributors.filter((contributor)=> (contributor.id === profile.id)).length > 0)) && (<UploadProcessing
				upload={upload}
				processing={this.state.processing}
				onCopyURL={this.handleCopyURL}
				onCancel={this.handleUploadProcessingCancel}
			/>)}


			{(tutorial) && (<TutorialOverlay
				origin={tutorial.origin}
				onNext={this.handleTutorialNextStep}
				onClose={()=> this.setState({ tutorial : null })}
			/>)}


			{(upload) && (<ReactNotifications
				onRef={(ref)=> (this.notification = ref)}
				title="Completed Processing"
				body={`Your design file "${upload.title}" is ready.`}
				icon={DE_LOGO_SMALL}
				timeout="6660"
				tag="processing-complete"
				onClick={(event)=> this.handleCloseNotification(event)}
			/>)}
		</>);
	}
}

export default connect(mapStateToProps, mapDispatchToProps)(InspectorPage);
