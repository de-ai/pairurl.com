
import React, { Component } from 'react';
import './InspectorPage.css';

import axios from 'axios';
import moment from 'moment-timezone';
import qs from 'qs';
import ReactNotifications from 'react-browser-notifications';
import cookie from 'react-cookies';
import CopyToClipboard from 'react-copy-to-clipboard';
import FontAwesome from 'react-fontawesome';
import ImageLoader from 'react-loading-image';
import Moment from 'react-moment';
import panAndZoomHoc from 'react-pan-and-zoom-hoc';
import { connect } from 'react-redux';
import { Column, Row } from 'simple-flexbox';

import BaseDesktopPage from './BaseDesktopPage';
import ContentModal from '../../elements/ContentModal';
import { POPUP_TYPE_INFO } from '../../elements/Popup';
import TutorialOverlay from '../../elements/TutorialOverlay';
// import InviteTeamForm from '../forms/InviteTeamForm';

import { MOMENT_TIMESTAMP } from '../../../consts/formats';
import { MINUS_KEY, PLUS_KEY } from '../../../consts/key-codes';
import { CANVAS_CAPTION, CANVAS_COLORS, MARCHING_ANTS } from '../../../consts/slice-canvas';
import { DE_LOGO_SMALL } from '../../../consts/uris';
import { setRedirectURI } from '../../../redux/actions';
import { buildInspectorPath, buildInspectorURL, capitalizeText, convertURISlug, cropFrame, epochDate, frameToRect, limitString, makeDownload, rectContainsRect } from '../../../utils/funcs.js';
import { fontSpecs, toAndroid, toCSS, toReactCSS, toSpecs, toSwift } from '../../../utils/inspector-langs.js';
import { trackEvent } from '../../../utils/tracking';
import deLogo from '../../../assets/images/logos/logo-designengine.svg';
import bannerPanel from '../../../assets/json/banner-panel';
import inspectorTabs from '../../../assets/json/inspector-tabs';


const STATUS_INTERVAL = 1250;
const PAN_MULT_OFFSET_PT = {
	x : 0.5,
	y : 0.5
};
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

const InteractiveDiv = panAndZoomHoc('div');
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

const drawSliceCaption = (context, text, origin, maxWidth)=> {
	let caption = text;
	let txtWidth = context.measureText(caption.toUpperCase()).width << 0;
	while ((txtWidth + CANVAS_CAPTION.padding) > maxWidth) {
		caption = `${caption.substring(0, -3)}…`;
		txtWidth = context.measureText(caption.toUpperCase()).width << 0;
		if (caption.length === 1) {
			break;
		}
	}

	const txtMetrics = {
		width   : txtWidth,
		height  : CANVAS_CAPTION.height,
		padding : CANVAS_CAPTION.padding
	};

	context.fillStyle = 'rgba(0, 0, 0, 0.125)';
	context.fillRect(origin.x + 1, (origin.y - txtMetrics.height) + 1, (txtMetrics.width + (txtMetrics.padding * 2)) - 2, txtMetrics.height - 1);

	context.strokeStyle = CANVAS_CAPTION.lineColor;
	context.lineWidth = 1;
	context.setLineDash([]);
	context.beginPath();
	context.strokeRect(origin.x + 1, (origin.y - txtMetrics.height) + 1, (txtMetrics.width + (txtMetrics.padding * 2)) - 2, txtMetrics.height);
	context.stroke();

	context.fillStyle = CANVAS_CAPTION.textColor;
	context.fillText(caption.toUpperCase(), txtMetrics.padding + origin.x, txtMetrics.padding + (origin.y - txtMetrics.height));
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
// 	console.log('InspectorPage.PartItem()', props);

	const { id, filename, title, type, size } = props;

	const thumbStyle = {
		width  : `${size.width * 0.25}px`,
		height : `${size.height * 0.25}px`
	};

	let errored = false;

	return (<div data-slice-id={id} className="part-item"><Row vertical="center">
		<ImageLoader
			style={thumbStyle}
			src={filename}
			image={(props)=> <PartItemThumb {...props} width={size.width * 0.25} height={size.height * 0.25} />}
			loading={()=> (<div className="part-item-image part-item-image-loading" style={thumbStyle}><FontAwesome name="circle-o-notch" size="2x" pulse fixedWidth /></div>)}
			error={()=> (<div className="part-item-image part-item-image-error"><FontAwesome name="exclamation-circle" /></div>)}
			onError={(event)=> (errored = true)}
		/>
		<div className="part-item-title">{`${limitString(title, Math.max(26 - type.length, 1))} (${capitalizeText(type, true)})`}</div>
		{(!errored) && (<button className="tiny-button part-item-button" onClick={()=> props.onClick()}><FontAwesome name="download" /></button>)}
	</Row></div>);
};

const PartItemThumb = (props)=> {
// 	console.log('InspectorPage.PartItemThumb()', props);

	const { src, title, width, height } = props;
	return (<img src={src} className="part-item-image" width={width} height={height} alt={title} />);
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
					filename={`${slice.filename}@3x.png`}
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

	const { upload, processing, vpHeight } = props;
	const artboard = buildUploadArtboards(upload).shift();
	const url = buildInspectorURL(upload);

	const imgStyle = (artboard) ? {
		width  : `${artboard.meta.frame.size.width * ((vpHeight - 300) / artboard.meta.frame.size.height)}px`,
		height : `${artboard.meta.frame.size.height * ((vpHeight - 300) / artboard.meta.frame.size.height)}px`
	} : null;

	return (<div className="upload-processing-wrapper"><Column horizontal="center" vertical="start">
		{(processing.message.length > 0) && (<Row><div className="upload-processing-title">{processing.message}</div></Row>)}
		<Row><CopyToClipboard onCopy={()=> props.onCopyURL()} text={url}>
			<div className="upload-processing-url">{url}</div>
		</CopyToClipboard></Row>

		<Row><div className="upload-processing-button-wrapper">
			<CopyToClipboard onCopy={()=> props.onCopyURL()} text={url}>
				<button className="adjacent-button">Copy</button>
			</CopyToClipboard>
			<button onClick={()=> props.onCancel()}>Cancel</button>
		</div></Row>

		<Row horizontal="center">{(artboard)
			? (<ImageLoader
					src={(!artboard.filename.includes('@')) ? `${artboard.filename}@0.25x.png` : artboard.filename}
					image={()=> (<img className="upload-processing-image" src={(!artboard.filename.includes('@')) ? `${artboard.filename}@0.25x.png` : artboard.filename} style={imgStyle} alt={upload.title} />)}
					loading={()=> (<div className="upload-processing-image upload-processing-image-loading"><FontAwesome name="circle-o-notch" size="2x" pulse fixedWidth /></div>)}
					error={()=> (<div className="upload-processing-image upload-processing-image-loading"><FontAwesome name="circle-o-notch" size="2x" pulse fixedWidth /></div>)}
				/>)
			: (<img className="upload-processing-image" src={bannerPanel.image} alt={bannerPanel.title} />)
		}</Row>
	</Column></div>);
};

const SliceRolloverItem = (props)=> {
// 	console.log('InspectorPage.SliceRolloverItem()', props);

	const { id, artboardID, type, offset, top, left, width, height, scale, visible, filled } = props;

	const className = `slice-rollover-item slice-rollover-item-${type}`;
	const style = (visible) ? {
		top     : `${top}px`,
		left    : `${left}px`,
		width   : `${width}px`,
		height  : `${height}px`,
		zoom    : scale,
// 		transform : `scale(${scale}) translate(${(left - (left * scale)) * -0.5}px, ${(top - (top * scale)) * -0.5}px)`,
// 		transform : `scale(${scale})`,
// 		transformOrigin : `${left * -scale}px ${top * -scale}px`
// 		margin  : `${(top) * -0.5}px ${(left - (left * scale)) * -0.5}px ${(top) * -0.5}px ${(left) * -0.5}px`
	} : {
		display : 'none'
	};

	return (<div
		data-slice-id={id}
		data-artboard-id={artboardID}
		className={`${className}${(filled) ? '-filled' : ''}`}
		style={style}
		onMouseEnter={()=> props.onRollOver(offset)}
		onMouseLeave={()=> props.onRollOut(offset)}
		onClick={()=> props.onClick(offset)}>
	</div>);
};

function SpecsList(props) {
// 	console.log('InspectorPage.SpecsList()', props);

	const { upload, slice, creatorID } = props;

	const fillColor = ((slice.type === 'textfield' && slice.meta.font.color) ? slice.meta.font.color : slice.meta.fillColor).toUpperCase();
	const padding = `${slice.meta.padding.top}px ${slice.meta.padding.left}px ${slice.meta.padding.bottom}px ${slice.meta.padding.right}px`;
	const added = `${slice.added.replace(' ', 'T')}Z`;//moment(`${slice.added.replace(' ', 'T')}Z`);
	const font = (slice.meta.font) ? fontSpecs(slice.meta.font) : null;
	const sliceStyles = (slice.meta.styles) ? slice.meta.styles : null;
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

	// <CopyToClipboard onCopy={()=> props.onCopySpec()} text={}>

	return (
		<div className="inspector-page-specs-list-wrapper">
			<CopyToClipboard onCopy={()=> props.onCopySpec()} text={slice.title}>
				<Row><div className="inspector-page-specs-list-attribute">Name</div><div className="inspector-page-specs-list-val">{slice.title}</div></Row>
			</CopyToClipboard>
			<CopyToClipboard onCopy={()=> props.onCopySpec()} text={capitalizeText(slice.type, true)}>
				<Row><div className="inspector-page-specs-list-attribute">Type</div><div className="inspector-page-specs-list-val">{capitalizeText(slice.type, true)}</div></Row>
			</CopyToClipboard>
			<CopyToClipboard onCopy={()=> props.onCopySpec()} text={`W: ${slice.meta.frame.size.width}px H: ${slice.meta.frame.size.height}px`}>
				<Row><div className="inspector-page-specs-list-attribute">Export Size</div><div className="inspector-page-specs-list-val">{`W: ${slice.meta.frame.size.width}px H: ${slice.meta.frame.size.height}px`}</div></Row>
			</CopyToClipboard>
			<CopyToClipboard onCopy={()=> props.onCopySpec()} text={`X: ${slice.meta.frame.origin.x}px Y: ${slice.meta.frame.origin.y}px`}>
				<Row><div className="inspector-page-specs-list-attribute">Position</div><div className="inspector-page-specs-list-val">{`X: ${slice.meta.frame.origin.x}px Y: ${slice.meta.frame.origin.y}px`}</div></Row>
			</CopyToClipboard>
			<CopyToClipboard onCopy={()=> props.onCopySpec()} text={`${slice.meta.rotation}°`}>
				<Row><div className="inspector-page-specs-list-attribute">Rotation</div><div className="inspector-page-specs-list-val">{slice.meta.rotation}&deg;</div></Row>
			</CopyToClipboard>
			<CopyToClipboard onCopy={()=> props.onCopySpec()} text={`${slice.meta.opacity * 100}%`}>
				<Row><div className="inspector-page-specs-list-attribute">Opacity</div><div className="inspector-page-specs-list-val">{slice.meta.opacity * 100}%</div></Row>
			</CopyToClipboard>
			<CopyToClipboard onCopy={()=> props.onCopySpec()} text={(fillColor.length > 0) ? fillColor : ''}>
				<Row><div className="inspector-page-specs-list-attribute">Fill</div>{(fillColor.length > 0) && (<div className="inspector-page-specs-list-val"><Row vertical="center">{fillColor}<ColorSwatch fill={fillColor} /></Row></div>)}</Row>
			</CopyToClipboard>
			<CopyToClipboard onCopy={()=> props.onCopySpec()} text={(border) ? `${styles.border.position} S: ${styles.border.thickness} ${styles.border.color}` : ''}>
				<Row><div className="inspector-page-specs-list-attribute">Border</div>{(border) && (<div className="inspector-page-specs-list-val"><Row vertical="center">{`${styles.border.position} S: ${styles.border.thickness} ${styles.border.color}`}<ColorSwatch fill={styles.border.color} /></Row></div>)}</Row>
			</CopyToClipboard>
			<CopyToClipboard onCopy={()=> props.onCopySpec()} text={(shadow) ? `X: ${styles.shadow.offset.x} Y: ${styles.shadow.offset.y} B: ${styles.shadow.blur} S: ${styles.shadow.spread}` : ''}>
				<Row><div className="inspector-page-specs-list-attribute">Shadow</div>{(shadow) && (<div className="inspector-page-specs-list-val"><Row vertical="center">{`X: ${styles.shadow.offset.x} Y: ${styles.shadow.offset.y} B: ${styles.shadow.blur} S: ${styles.shadow.spread}`}<ColorSwatch fill={styles.shadow.color} /></Row></div>)}</Row>
			</CopyToClipboard>
			<CopyToClipboard onCopy={()=> props.onCopySpec()} text={(innerShadow) ? `X: ${styles.innerShadow.offset.x} Y: ${styles.innerShadow.offset.y} B: ${styles.innerShadow.blur} S: ${styles.shadow.spread}` : ''}>
				<Row><div className="inspector-page-specs-list-attribute">Inner Shadow</div>{(innerShadow) && (<div className="inspector-page-specs-list-val"><Row vertical="center">{`X: ${styles.innerShadow.offset.x} Y: ${styles.innerShadow.offset.y} B: ${styles.innerShadow.blur} S: ${styles.shadow.spread}`}<ColorSwatch fill={styles.innerShadow.color} /></Row></div>)}</Row>
			</CopyToClipboard>
			{(slice.type === 'textfield') && (<>
				<CopyToClipboard onCopy={()=> props.onCopySpec()} text={`${font.family} ${font.name}`}>
					<Row><div className="inspector-page-specs-list-attribute">Font</div><div className="inspector-page-specs-list-val">{`${font.family} ${font.name}`}</div></Row>
				</CopyToClipboard>
				<CopyToClipboard onCopy={()=> props.onCopySpec()} text={font.weight}>
					<Row><div className="inspector-page-specs-list-attribute">Font Weight</div><div className="inspector-page-specs-list-val">{font.weight}</div></Row>
				</CopyToClipboard>
				<CopyToClipboard onCopy={()=> props.onCopySpec()} text={`${font.size}px`}>
					<Row><div className="inspector-page-specs-list-attribute">Font Size</div><div className="inspector-page-specs-list-val">{`${font.size}px`}</div></Row>
				</CopyToClipboard>
				<CopyToClipboard onCopy={()=> props.onCopySpec()} text={(font.color) ? font.color.toUpperCase() : ''}>
					<Row><div className="inspector-page-specs-list-attribute">Font Color</div><div className="inspector-page-specs-list-val"><Row vertical="center">{(font.color) ? font.color.toUpperCase() : ''}<ColorSwatch fill={font.color} /></Row></div></Row>
				</CopyToClipboard>
				<CopyToClipboard onCopy={()=> props.onCopySpec()} text={(font.alignment) ? capitalizeText(font.alignment) : 'Left'}>
					<Row><div className="inspector-page-specs-list-attribute">Alignment</div><div className="inspector-page-specs-list-val">{(font.alignment) ? capitalizeText(font.alignment) : 'Left'}</div></Row>
				</CopyToClipboard>
				<CopyToClipboard onCopy={()=> props.onCopySpec()} text={(font.lineHeight) ? `${font.lineHeight}px` : ''}>
					<Row><div className="inspector-page-specs-list-attribute">Line Spacing</div>{(font.lineHeight) && (<div className="inspector-page-specs-list-val">{`${font.lineHeight}px`}</div>)}</Row>
				</CopyToClipboard>
				<CopyToClipboard onCopy={()=> props.onCopySpec()} text={(font.kerning) ? `${font.kerning.toFixed(2)}px` : ''}>
					<Row><div className="inspector-page-specs-list-attribute">Char Spacing</div>{(font.kerning) && (<div className="inspector-page-specs-list-val">{`${font.kerning.toFixed(2)}px`}</div>)}</Row>
				</CopyToClipboard>
			</>)}
			<CopyToClipboard onCopy={()=> props.onCopySpec()} text={(padding) ? padding : ''}>
				<Row><div className="inspector-page-specs-list-attribute">Padding</div>{(padding) && (<div className="inspector-page-specs-list-val">{padding}</div>)}</Row>
			</CopyToClipboard>
			<CopyToClipboard onCopy={()=> props.onCopySpec()} text={capitalizeText(slice.meta.blendMode, true)}>
				<Row><div className="inspector-page-specs-list-attribute">Blend Mode</div><div className="inspector-page-specs-list-val">{capitalizeText(slice.meta.blendMode, true)}</div></Row>
			</CopyToClipboard>
			<CopyToClipboard onCopy={()=> props.onCopySpec()} text={added}>
				<Row><div className="inspector-page-specs-list-attribute">Date</div>{(added) && (<div className="inspector-page-specs-list-val"><Moment format={MOMENT_TIMESTAMP}>{added}</Moment></div>)}</Row>
			</CopyToClipboard>
			<CopyToClipboard onCopy={()=> props.onCopySpec()} text={upload.creator.username}>
				<Row><div className="inspector-page-specs-list-attribute">Uploader</div><div className="inspector-page-specs-list-val">{upload.creator.username + ((creatorID === upload.creator.user_id) ? ' (You)' : '')}</div></Row>
			</CopyToClipboard>
		</div>
	);
}


class InspectorPage extends Component {
	constructor(props) {
		super(props);

		this.state = {
			section     : window.location.pathname.substr(1).split('/').shift(),
			upload      : null,
			artboard    : null,
			slice       : null,
			hoverSlice  : null,
			offset      : null,
			hoverOffset : null,
			selectedTab : 0,
			tabs        : [],
			scale       : 1.0,
			fitScale    : 0.0,
			panMultPt   : PAN_MULT_OFFSET_PT,
			viewSize    : {
				width  : 0,
				height : 0
			},
			scrollPt    : {
				x : 0,
				y : 0
			},
			valid       : true,
			restricted  : false,
			shareModal  : false,
			urlBanner   : true,
			scrolling   : false,
			tutorial    : null,
			code        : {
				html   : '',
				syntax : ''
			},
			processing  : {
				state   : 0,
				message : ''
			},
			tooltip     : ''
		};

		this.recordedHistory = false;
		this.processingInterval = null;
		this.canvasInterval = null;
		this.scrollTimeout = null;
		this.notification = null;
		this.antsOffset = 0;
		this.contentSize = {
			width  : 0,
			height : 0
		};
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

		const { profile, deeplink, processing } = this.props;
// 		const { upload, panMultPt } = this.state;
		const { upload } = this.state;

		if (!this.recordedHistory && profile && upload && deeplink && deeplink.uploadID !== 0) {
			this.recordedHistory = true;
			this.onAddHistory();
		}

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


		if (artboardsWrapper.current && (this.state.viewSize.width + this.state.viewSize.height) === 0) {
			const viewSize = {
				width  : artboardsWrapper.current.clientWidth,
				height : artboardsWrapper.current.clientHeight
			};

			this.setState({ viewSize });
		}

		if (this.state.fitScale === 0.0 && (this.contentSize.width + this.contentSize.height) > 0 && (this.state.viewSize.width + this.state.viewSize.height) > 0) {
			const fitScale = Math.max(Math.min(this.state.viewSize.height / this.contentSize.height, this.state.viewSize.width / this.contentSize.width, ZOOM_NOTCHES.slice(-1)[0]), ZOOM_NOTCHES[0]);
			const scrollPt = this.calcScrollPoint(PAN_MULT_OFFSET_PT, this.state.viewSize, this.contentSize, fitScale);

// 			const scrollPt = {
// 				x : -Math.round(((0.5 + scale * (0.5 - panMultPt.x)) * this.state.viewSize.width) + ((this.contentSize.width * scale) * -0.5)),
// 				y : -Math.round(((0.5 + scale * (0.5 - panMultPt.y)) * this.state.viewSize.height) + ((this.contentSize.height * scale) * -0.5))
// 			};

			console.log('-=-=-=-=-=-', this.state.viewSize, this.contentSize, fitScale, scrollPt);
			this.setState({ scale : fitScale, fitScale }, ()=> (this.handlePanMove(PAN_MULT_OFFSET_PT.x, PAN_MULT_OFFSET_PT.y)));
		}

		if (upload && canvasWrapper.current) {
			if (!this.state.tutorial && cookie.load('tutorial') === '0') {
				cookie.save('tutorial', '1', { path : '/' });

				const { scrollPt } = this.state;
				let artboard = buildUploadArtboards(upload).pop();
				artboard.meta = JSON.parse(artboard.meta);
				const tutorial = {
					origin : {
						top  : `${5 + -scrollPt.y}px`,
						left : `${5 + -scrollPt.x}px`
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


	calcArtboardBaseMetrics = (artboards, vpSize)=> {
		console.log('InspectorPage.calcArtboardBaseMetrics()', artboards, vpSize);

		const vpRatio = {
			width  : vpSize.width / vpSize.height,
			height : vpSize.height / vpSize.width
		};

		let baseMetrics = {
			size  : {
				width  : 1,
				height : 1
			},
			grid  : {
				cols : 0,
				rows : 0
			},
			grids : []
		};

		artboards.map((artboard, i)=> ({
			id   : artboard.id,
			row  : 0,
			col  : 0,
			size : {
				width  : JSON.parse(artboard.meta).frame.size.width,
				height : JSON.parse(artboard.meta).frame.size.height
			},
			area : JSON.parse(artboard.meta).frame.size.width * JSON.parse(artboard.meta).frame.size.height

		})).sort((a, b)=> { // desc
			return ((a.area > b.area) ? -1 : (a.area < b.area) ? 1 : 0);

		}).forEach((metric, i)=> {
			const baseRatio = {
				width  : baseMetrics.size.width / baseMetrics.size.height,
				height : baseMetrics.size.height / baseMetrics.size.width
			};

			if (baseRatio.width < vpRatio.width || baseRatio.height > vpRatio.height) {
				baseMetrics.grid.cols++;
				baseMetrics.size.width += metric.size.width;
				metric.col++;

			} else {
				baseMetrics.grid.cols = 0;
				baseMetrics.grid.rows++;
				baseMetrics.size.height += metric.size.height;
				metric.row++;
			}

			baseMetrics.grids.push({
				id  : metric.id,
				row : metric.row,
				col : metric.col
			});
		});

		return (baseMetrics);
	};

	calcArtboardScaledMetrics = (artboards, baseMetrics, scale)=> {
		console.log('InspectorPage.calcArtboardScaledMetrics()', artboards, baseMetrics, scale);

		let scaledMetrics = [];
		let coords = {
			x : 0,
			y : 0
		};

		let rowHeight = 0;
		artboards.forEach((artboard, i)=> {
			const frame = JSON.parse(artboard.meta).frame;
			const grid = baseMetrics.grids.filter((metric)=> (metric.id === artboard.id)).pop();

// 			rowHeight = Math.round((grid.col === 0) ? ((grid.row !== 0 && grid.row < baseMetrics.grid.rows) ? 50 : 0) + (scale * frame.size.height) : Math.max(rowHeight, scale * frame.size.height));
			rowHeight = Math.round((grid.col === 0) ? 0 : Math.max(rowHeight, scale * frame.size.height));
			coords = {
// 				x : Math.round(((grid.col !== 0 && grid.col < baseMetrics.grid.cols) ? 50 : 0) + (grid.col * (scale * frame.size.width))),
				x : Math.round(grid.col * (scale * frame.size.width)),
				y : Math.round((grid.row > 0 && grid.col === 0) ? rowHeight : coords.y)
			};

			scaledMetrics.push({ artboard, coords });
		});


		return (scaledMetrics);
	};

	calcCanvasSliceFrame = (slice, artboard, offset, scrollPt)=> {
// 		console.log('InspectorPage.calcCanvasSliceFrame()', slice, artboard, offset, scrollPt);

		const { scale } = this.state;
		const srcFrame = cropFrame(slice.meta.frame, artboard.meta.frame);
		const srcOffset = {
			x : ((offset.x - scrollPt.x) << 0),
			y : ((offset.y - scrollPt.y) << 0)
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

	calcFitScale = (baseSize, vpSize)=> {
		console.log('InspectorPage.calcFitScale()', baseSize, vpSize);
		return (Math.max(Math.min(vpSize.height / baseSize.height, vpSize.width / baseSize.width, Math.max(...ZOOM_NOTCHES)), Math.min(...ZOOM_NOTCHES)));
	};

	calcScrollPoint = (panPt, vpSize, baseSize, scale)=> {
		console.log('InspectorPage.calcScrollPoint()', panPt, vpSize, baseSize, scale);

		const pt = this.calcTransformPoint();
		return ({
			x : -Math.round((pt.x * vpSize.width) + ((baseSize.width * scale) * -0.5)),
// 			x : -Math.round((vpSize.width - (baseSize.height * scale)) * 0.5),
			y : -Math.round((pt.y * vpSize.height) + ((baseSize.height * scale) * -0.5))
		});
	};

	calcTransformPoint = ()=> {
// 		console.log('InspectorPage.calcTransformPoint()');

		const { panMultPt, scale } = this.state;
		return {
			x : 0.5 + scale * (PAN_MULT_OFFSET_PT.x - panMultPt.x),
			y : 0.5 + scale * (PAN_MULT_OFFSET_PT.y - panMultPt.y)
		};
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
// 		console.log('InspectorPage.handleArtboardRollOver()', event.target);

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
// 		console.log('InspectorPage.handleCanvasClick()', event.target);
		event.stopPropagation();

		const tabs = [...this.state.tabs];
		tabs.forEach((tab, i)=> {
			tabs[i] = {
				id       : tab.id,
				title    : tab.title,
				contents : null,
				syntax   : null
			}
		});

// 		this.setState({ tabs, slice : null });
	};

	handleCanvasUpdate = ()=> {
// 		console.log('InspectorPage.handleCanvasUpdate()', this.antsOffset);

		const { scrollPt, offset, hoverOffset } = this.state;
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
				const frame = this.calcCanvasSliceFrame(slice, artboard, offset, scrollPt);
				drawSliceFill(context, frame, CANVAS_COLORS.types[slice.type].fill);
				drawSliceCaption(context, slice.type, frame.origin, frame.size.width);
				drawSliceBorder(context, frame);
				drawSliceGuides(context, frame, { width : canvas.current.clientWidth, height : canvas.current.clientHeight }, CANVAS_COLORS.types[slice.type].guides);
				drawSliceMarchingAnts(context, frame, this.antsOffset);
			}

			if (hoverSlice) {
				if (!slice || (slice && slice.id !== hoverSlice.id)) {
					const frame = this.calcCanvasSliceFrame(hoverSlice, artboard, hoverOffset, scrollPt);
					drawSliceFill(context, frame, CANVAS_COLORS.types[hoverSlice.type].fill);
					drawSliceCaption(context, hoverSlice.type, frame.origin, frame.size.width);
					drawSliceBorder(context, frame);
					drawSliceGuides(context, frame, { width : canvas.current.clientWidth, height : canvas.current.clientHeight }, CANVAS_COLORS.types[hoverSlice.type].guides);
					drawSliceMarchingAnts(context, frame, this.antsOffset);
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

	handleCopySpec = ()=> {
		console.log('InspectorPage.handleCopySpec()');

		trackEvent('button', 'copy-spec');
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

	handlePanAndZoom = (x, y, scale) => {
// 		console.log('InspectorPage.handlePanAndZoom()', x, y, scale);

// 		const panMultPt = { x, y };
// 		this.setState({ panMultPt, scale });
// 		this.setState({ panMultPt });
// 		this.setState({ scale });
	};

	handlePanMove = (x, y) => {
// 		console.log('InspectorPage.handlePanMove()', x, y, this.state.scale);

		const panMultPt = { x, y };
		const { viewSize } = this.state;
		const pt = this.calcTransformPoint();

		const scrollPt = {
			x : -Math.round((pt.x * viewSize.width) + (this.contentSize.width * -0.5)),
			y : -Math.round((pt.y * viewSize.height) + (this.contentSize.height * -0.5))
		};

		this.setState({ panMultPt, scrollPt });
	};

	handleSliceClick = (ind, slice, offset)=> {
// 		console.log('InspectorPage.handleSliceClick()', ind, slice, offset);

		trackEvent('slice', `${slice.id}_${convertURISlug(slice.title)}`);

		const { upload, artboard, section } = this.state;
		let { tabs } = this.state;

		artboard.slices.filter((item)=> (item.id !== slice.id)).forEach((item)=> {
			item.filled = false;
		});

		slice.filled = true;

		const css = toCSS(slice);
		const reactCSS = toReactCSS(slice);
		const swift = toSwift(slice, artboard);
		const android = toAndroid(slice, artboard);

		if (section === 'inspect') {
			tabs[0].contents = css.html;
			tabs[0].syntax = css.syntax;
			tabs[1].contents = reactCSS.html;
			tabs[1].syntax = reactCSS.syntax;
			tabs[2].contents = swift.html;
			tabs[2].syntax = swift.syntax;
			tabs[3].contents = android.html;
			tabs[3].syntax = android.syntax;

		} else if (section === 'parts') {
			tabs[0].contents = buildSlicePreviews(upload, slice);
		}

		this.setState({ tabs, artboard, slice, offset,
			hoverSlice  : null,
			hoverOffset : null
		});
	};

	handleSliceRollOut = (ind, slice, offset)=> {
// 		console.log('InspectorPage.handleSliceRollOut()', ind, slice, offset, this.state);

		const { upload, artboard, section } = this.state;
		let tabs = [...this.state.tabs];

		if (this.state.slice) {
			const css = toCSS(this.state.slice);
			const reactCSS = toReactCSS(this.state.slice);
			const swift = toSwift(this.state.slice, artboardByID(upload, this.state.slice.artboardID));
			const android = toAndroid(this.state.slice, artboard);

			if (section === 'inspect') {
				tabs[0].contents = css.html;
				tabs[0].syntax = css.syntax;
				tabs[1].contents = reactCSS.html;
				tabs[1].syntax = reactCSS.syntax;
				tabs[2].contents = swift.html;
				tabs[2].syntax = swift.syntax;
				tabs[3].contents = android.html;
				tabs[3].syntax = android.syntax;

			} else if (section === 'parts') {
				tabs[0].contents = buildSlicePreviews(upload, this.state.slice);
			}

		} else {
			this.handleSliceClick(ind, slice, offset);

// 			artboard.slices.forEach((item)=> {
// 				item.filled = false;
// 			});
//
// 			tabs.forEach((tab, i)=> {
// 				tabs[i] = {
// 					id       : tab.id,
// 					title    : tab.title,
// 					contents : null,
// 					syntax   : null
// 				}
// 			});
		}

		this.setState({ artboard, tabs,
			hoverSlice  : null,
			hoverOffset : null
		});
	};

	handleSliceRollOver = (ind, slice, offset)=> {
// 		console.log('InspectorPage.handleSliceRollOver()', ind, slice, offset);

		const { upload, artboard, section } = this.state;
		let tabs = [...this.state.tabs];

		if (artboard) {
			artboard.slices.filter((item) => (this.state.slice && this.state.slice.id !== item.id)).forEach((item) => {
				item.filled = false;
			});

			slice.filled = true;

			const css = toCSS(slice);
			const reactCSS = toReactCSS(slice);
			const swift = toSwift(slice, artboardByID(upload, slice.artboardID));
			const android = toAndroid(slice, artboard);

			if (section === 'inspect') {
				tabs[0].contents = css.html;
				tabs[0].syntax = css.syntax;
				tabs[1].contents = reactCSS.html;
				tabs[1].syntax = reactCSS.syntax;
				tabs[2].contents = swift.html;
				tabs[2].syntax = swift.syntax;
				tabs[3].contents = android.html;
				tabs[3].syntax = android.syntax;

			} else if (section === 'parts') {
				tabs[0].contents = buildSlicePreviews(upload, slice);
			}

			this.setState({ artboard, tabs,
				hoverSlice  : slice,
				hoverOffset : offset
			});
		}
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
		console.log('InspectorPage.handleWheelStart()', event, event.type, event.deltaX, event.deltaY, event.target);
		//console.log('wheel', artboardsWrapper.current.clientWidth, artboardsWrapper.current.clientHeight, artboardsWrapper.current.scrollTop, artboardsWrapper.current.scrollLeft);

		clearTimeout(this.scrollTimeout);
		this.scrollTimeout = null;

		event.stopPropagation();

		if (event.ctrlKey) {
			event.preventDefault();
			this.setState({
				scrolling : true,
				scale     : Math.min(Math.max(this.state.scale - (event.deltaY * PAN_FACTOR), 0.03), 3).toFixed(2),
				tooltip   : `${(Math.min(Math.max(this.state.scale - (event.deltaY * PAN_FACTOR), 0.03), 3).toFixed(2) * 100) << 0}%`
			});

		} else {
			const panMultPt = {
				x : this.state.panMultPt.x + (event.deltaX * PAN_FACTOR),
				y : this.state.panMultPt.y + (event.deltaY * PAN_FACTOR)
			};

			this.setState({
				scrolling : true,
				panMultPt : panMultPt,
			}, ()=> (this.handlePanMove(panMultPt.x, panMultPt.y)));
		}

		this.scrollTimeout = setTimeout(()=> this.onWheelTimeout(), 50);
	};

	handleZoom = (direction)=> {
// 		console.log('InspectorPage.handleZoom()', direction);

		const { fitScale } = this.state;
		let scale = fitScale;

		if (direction !== 0) {
			let ind = -1;
			ZOOM_NOTCHES.forEach((amt, i)=> {
				if (amt === this.state.scale) {
					ind = i + direction;
				}
			});

			ZOOM_NOTCHES.forEach((amt, i)=> {
				if (ind === -1) {
					if (direction === 1) {
						if (amt > this.state.scale) {
							ind = i;
						}

					} else {
						if (amt > this.state.scale) {
							ind = i - 1;
						}
					}
				}
			});

			scale = ZOOM_NOTCHES[Math.min(Math.max(0, ind), ZOOM_NOTCHES.length - 1)];
		}

		this.setState({
			slice     : null,
			offset    : null,
			panMultPt : PAN_MULT_OFFSET_PT,
			scale     : scale,
			tooltip   : `${(scale * 100) << 0}%`
		}, ()=> this.handlePanMove(PAN_MULT_OFFSET_PT.x, PAN_MULT_OFFSET_PT.y));

		setTimeout(()=> {
			this.setState({ tooltip : '' });
		}, 1000);
	};

	onAddHistory = ()=> {
		console.log('InspectorPage.onAddHistory()');

		const { deeplink, profile } = this.props;

		let formData = new FormData();
		formData.append('action', 'ADD_HISTORY');
		formData.append('user_id', profile.id);
		formData.append('upload_id', deeplink.uploadID);
		axios.post('https://api.designengine.ai/system.php', formData)
			.then((response)=> {
				console.log('ADD_HISTORY', response.data);
			}).catch((error)=> {
		});
	};

	onCanvasInterval = ()=> {
// 		console.log('InspectorPage.onCanvasInterval()', this.antsOffset);

		const { scrolling } = this.state;

		if (canvas.current && !scrolling) {
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
				const ellipsis = Array((epochDate() % 4) + 1).join('.');

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
		const { viewSize, section } = this.state;

		this.setState({ tooltip : 'Loading…' });

		axios.post('https://api.designengine.ai/system.php', qs.stringify({
			action    : 'UPLOAD',
			upload_id : uploadID
		})).then((response)=> {
			console.log('UPLOAD', response.data);

			const { upload } = response.data;
			if (Object.keys(upload).length > 0) {
				const artboards = buildUploadArtboards(upload);
				const tabs = inspectorTabs[section];
				const tooltip = '';

				const baseMetrics = this.calcArtboardBaseMetrics(artboards, viewSize);
				console.log(':::::BASE METRICS:::::', baseMetrics);

				const fitScale = this.calcFitScale(baseMetrics.size, viewSize);
				console.log(':::::FIT SCALE:::::', fitScale);

				const scaledMetrics = this.calcArtboardScaledMetrics(artboards, baseMetrics, fitScale);
				console.log(':::::SCALED METRICS:::::', scaledMetrics);

// 			this.setState({ upload, tabs, scale : fitScale, fitScale, tooltip });
				this.setState({ upload, tabs, tooltip });

				const processing = (parseInt(upload.state, 10) < 3);
				if (processing && !this.props.processing && !this.processingInterval) {
					this.props.onProcessing(true);
				}

			} else {
				this.setState({
					valid   : false,
					tooltip : ''
				});
			}
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

		const { section, upload, slice, hoverSlice, tabs, scale, fitScale, selectedTab, scrolling, viewSize, panMultPt } = this.state;
		const { valid, restricted, urlBanner, tutorial, tooltip } = this.state;

		const artboards = (upload) ? buildUploadArtboards(upload).reverse() : [];
		const activeSlice = (hoverSlice) ? hoverSlice : slice;

		const urlClass = `inspector-page-url-wrapper${(!urlBanner) ? ' inspector-page-url-outro' : ''}`;

		const pt = this.calcTransformPoint();

		this.contentSize = {
			width  : 0,
			height : 0
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
			this.contentSize.height = Math.max(this.contentSize.height, offset.y + maxH);

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
					onRollOut={(offset)=> this.handleSliceRollOut(i, slice, offset)}
					onClick={(offset)=> this.handleSliceClick(i, slice, offset)}
				/>)
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
					onRollOut={(offset)=> this.handleSliceRollOut(i, slice, offset)}
					onClick={(offset)=> this.handleSliceClick(i, slice, offset)}
				/>)
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
					onRollOut={(offset)=> this.handleSliceRollOut(i, slice, offset)}
					onClick={(offset)=> this.handleSliceClick(i, slice, offset)}
				/>)
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
					onRollOut={(offset)=> this.handleSliceRollOut(i, slice, offset)}
					onClick={(offset)=> this.handleSliceClick(i, slice, offset)}
				/>)
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
					onRollOut={(offset)=> this.handleSliceRollOut(i, slice, offset)}
					onClick={(offset)=> this.handleSliceClick(i, slice, offset)}
				/>)
			);

			artboardImages.push(
				<div key={i} style={artboardStyle}>
					<div className="inspector-page-artboard-caption">{artboard.title}</div>
				</div>
			);

			slices.push(
				<div key={i} data-artboard-id={artboard.id} className="inspector-page-slices-wrapper" style={slicesWrapperStyle} onMouseOver={this.handleArtboardRollOver} onMouseOut={this.handleArtboardRollOut} onDoubleClick={(event)=> this.handleZoom(1)}>
					<div data-artboard-id={artboard.id} className="inspector-page-group-slices-wrapper">{groupSlices}</div>
					<div data-artboard-id={artboard.id} className="inspector-page-background-slices-wrapper">{backgroundSlices}</div>
					<div data-artboard-id={artboard.id} className="inspector-page-symbol-slices-wrapper">{symbolSlices}</div>
					<div data-artboard-id={artboard.id} className="inspector-page-textfield-slices-wrapper">{textfieldSlices}</div>
					<div data-artboard-id={artboard.id} className="inspector-page-slice-slices-wrapper">{sliceSlices}</div>
				</div>
			);

			offset.x += Math.round(((i % 5 < 4) ? 50 : 0) + (artboard.meta.frame.size.width * scale));
			this.contentSize.width = Math.max(this.contentSize.width, offset.x);
		});

		artboardImages = (!restricted) ? artboardImages : [];
		slices = (!restricted) ? slices : [];

		const artboardsStyle = {
			position  : 'absolute',
// 			width     : `${viewSize.width * scale}px`,
			width     : `${this.contentSize.width}px`,
// 			height    : `${viewSize.height * scale}px`,
			height    : `${this.contentSize.height}px`,
			transform : `translate(${Math.round(pt.x * viewSize.width)}px, ${Math.round(pt.y * viewSize.height)}px) translate(${Math.round(this.contentSize.width * -0.5)}px, ${Math.round(this.contentSize.height * -0.5)}px)`,
// 			transform : `translate(${ARTBOARD_ORIGIN.x}px, ${ARTBOARD_ORIGIN.y}px)`,
			opacity   : (processing) ? '0' : '1'
		};

		const canvasStyle = (!scrolling) ? {
			top     : `${-Math.round((pt.y * viewSize.height) + (this.contentSize.height * -0.5))}px`,
			left    : `${-Math.round((pt.x * viewSize.width) + (this.contentSize.width * -0.5))}px`
		} : {
			display : 'none'
		};


// 		console.log('InspectorPage.render()', this.state, this.contentSize);
		console.log('InspectorPage.render()', this.props, this.state);
// 		console.log('InspectorPage:', window.performance.memory);

		return (<>
			<BaseDesktopPage className="inspector-page-wrapper">
				<div className="inspector-page-content">
					<InteractiveDiv
						x={panMultPt.x}
						y={panMultPt.y}
						scale={scale}
						scaleFactor={1.0875}
						minScale={Math.min(...ZOOM_NOTCHES)}
						maxScale={Math.max(...ZOOM_NOTCHES)}
						ignorePanOutside={true}
						renderOnChange={false}
						style={{ width : '100%', height : '100%' }}
// 						onPanStart={()=> this.setState({ scrolling : true })}
						onPanMove={this.handlePanMove}
// 						onPanEnd={()=> (this.setState({ scrolling : false }))}
						onPanAndZoom={this.handlePanAndZoom}
					>
						<div className="inspector-page-artboards-wrapper" ref={artboardsWrapper}>
							{(artboards.length > 0) && (<div style={artboardsStyle}>
								{artboardImages}
								<div className="inspector-page-canvas-wrapper" onClick={(event)=> this.handleCanvasClick(event)} onDoubleClick={()=> this.handleZoom(1)} style={canvasStyle} ref={canvasWrapper}>
									<canvas width={(artboardsWrapper.current) ? artboardsWrapper.current.clientWidth : 0} height={(artboardsWrapper.current) ? artboardsWrapper.current.clientHeight : 0} ref={canvas}>Your browser does not support the HTML5 canvas tag.</canvas>
								</div>
								{slices}
							</div>)}
						</div>
					</InteractiveDiv>

					{(upload && !processing) && (<div className="inspector-page-footer-wrapper"><Row vertical="center">
						<img src={deLogo} className="inspector-page-footer-logo" alt="Design Engine" />
						<div className="inspector-page-footer-button-wrapper">
							{(profile && (parseInt(upload.id, 10) === 1 || upload.contributors.filter((contributor)=> (contributor.id === profile.id)).length > 0)) && (<button className="adjacent-button" onClick={()=> {trackEvent('button', 'share'); this.setState({ shareModal : true })}}>Share</button>)}
							<button disabled={(scale >= Math.max(...ZOOM_NOTCHES))} className="inspector-page-zoom-button" onClick={()=> {trackEvent('button', 'zoom-in'); this.handleZoom(1)}}><FontAwesome name="search-plus" /></button>
							<button disabled={(scale <= Math.min(...ZOOM_NOTCHES))} className="inspector-page-zoom-button" onClick={()=> {trackEvent('button', 'zoom-out'); this.handleZoom(-1)}}><FontAwesome name="search-minus" /></button>
							<button disabled={(scale === fitScale)} className="inspector-page-zoom-button" onClick={()=> {trackEvent('button', 'zoom-reset'); this.handleZoom(0)}}><FontAwesome name="ban" /></button>
						</div>
					</Row></div>)}
				</div>

				{(valid) && (<div className="inspector-page-panel">
					{(section === 'inspect') && (<>
						<div className="inspector-page-panel-split-content-wrapper">
							<ul className="inspector-page-panel-tab-wrapper">
								{(tabs.map((tab, i)=> (<li key={i} className={`inspector-page-panel-tab${(selectedTab === i) ? ' inspector-page-panel-tab-selected' : ''}`} onClick={()=> this.handleTab(tab)}>{tab.title}</li>)))}
							</ul>
							<div className="inspector-page-panel-tab-content-wrapper">
								{(tabs.filter((tab, i)=> (i === selectedTab)).map((tab, i)=> {
									return (<div key={i} className="inspector-page-panel-tab-content">
										<span dangerouslySetInnerHTML={{ __html : (tab.contents) ? String(JSON.parse(tab.contents).replace(/ /g, '&nbsp;').replace(/</g, '&lt;').replace(/>/g, '&gt').replace(/\n/g, '<br />')) : '' }} />
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
									{(upload && activeSlice) && (<SpecsList
										upload={upload}
										slice={activeSlice}
										creatorID={(profile) ? profile.id : 0}
										onCopySpec={this.handleCopySpec}
									/>)}
								</div>
							</div>
						</div>
						<div className="inspector-page-panel-button-wrapper">
							<CopyToClipboard onCopy={()=> this.handleCopyCode()} text={(activeSlice) ? toSpecs(activeSlice) : ''}>
								<button className="inspector-page-panel-button">Copy to Clipboard</button>
							</CopyToClipboard>
						</div>
					</>)}

					{(section === 'parts') && (<>
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
					</>)}
				</div>)}
			</BaseDesktopPage>


			{(tooltip !== '' && !processing) && (<div className="inspector-page-tooltip">{tooltip}</div>)}
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
				vpHeight={viewSize.height}
				onCopyURL={this.handleCopyURL}
				onCancel={this.handleUploadProcessingCancel}
			/>)}

			{(tutorial) && (<TutorialOverlay
				origin={tutorial.origin}
				onNext={this.handleTutorialNextStep}
				onClose={()=> this.setState({ tutorial : null })}
			/>)}

			{(!upload && !valid) && (<ContentModal
				tracking="invalid/inspector"
				closeable={true}
				defaultButton={null}
				title="Error Loading Project"
				onComplete={()=> this.props.onPage('<<')}>
				This project was not found, please check your link!
			</ContentModal>)}


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
