
import React, { Component } from 'react';
import './BaseOverlay.css';

import { TimelineMax, Back } from 'gsap/TweenMax';
import onClickOutside from 'react-onclickoutside';

import { trackOverlay } from '../../../utils/tracking';

import { OVERLAY_TYPE_AUTO_SIZE, OVERLAY_TYPE_POSITION_OFFSET, OVERLAY_TYPE_PERCENT_SIZE } from './';


const INTRO_DURATION = (1/8);
const OUTRO_DURATION = (1/4);


class BaseOverlay extends Component {
	constructor(props) {
		super(props);

		this.state = {
			outro     : false,
			completed : false
		};

//     this.timeline = new TimelineMax();
		this.wrapper = null;
	}

	componentDidMount() {
// 		console.log('%s.componentDidMount()', this.constructor.name, this.props, this.state);

		const { tracking } = this.props;
		trackOverlay(`open${tracking}`);
		this.onIntro();
	}

	componentDidUpdate(prevProps, prevState, snapshot) {
// 		console.log('%s.componentDidUpdate()', this.constructor.name, prevProps, this.props, this.state);
		console.log('%s.componentDidUpdate()', this.constructor.name, { prevProps : prevProps.outro, props : this.props.outro });

// 		const { completed } = this.state;
    if (prevProps.outro !== this.props.outro && this.props.outro) {
// 			this.setState({ completed : false }, ()=> {
				this.onOutro();
// 			});

    } else if (prevProps.outro !== this.props.outro && !this.props.outro) {
      this.setState({ completed : false }, ()=> {
        this.onIntro();
      });
		}
	}

	componentWillUnmount() {
// 		console.log('%s.componentWillUnmount()', this.constructor.name);
		const { tracking } = this.props;
		trackOverlay(`close${tracking}`);

		this.timeline = null;
	}

	handleClickOutside(event) {
		const { closeable, blocking } = this.props;
		if (!blocking && closeable) {
			this.onOutro();
		}
	}

	handleClose = ()=> {
// 		console.log('%s.handleClose()', this.constructor.name, this.props);
		this.onOutro();
	};

	handleComplete = ()=> {
    console.log('%s.handleComplete()', this.constructor.name, this.props, this.state);

    const { onComplete } = this.props;
    this.setState({ completed : true }, ()=> {
    	if (onComplete) {
    		onComplete();
			}
    });
	};

	onIntro = ()=> {
    console.log('%s.onIntro()', this.constructor.name, this.props, this.state, this.timeline);

    const { tracking, delay } = this.props;
    trackOverlay(`open${tracking}`);

    this.timeline = new TimelineMax();
    this.timeline.from(this.wrapper, INTRO_DURATION, {
      opacity : 0.5,
      scale   : 0.875,
      ease    : Back.easeOut,
      delay   : (delay || 0) * 0.001,
			onComplete : ()=> {
        console.log('%s.onIntro().onIntroComplete', this.constructor.name, this.props, this.state, this.timeline);
			}
    });
	};

	onOutro = ()=> {
    console.log('%s.onOutro()', this.constructor.name, this.props, this.state, this.timeline);

    this.timeline = new TimelineMax();
    this.timeline.to(this.wrapper, OUTRO_DURATION, {
      opacity    : 0.75,//0.25,
      scale      : 0.5,
      ease       : Back.easeIn,
      onComplete : ()=> {
//         console.log('%s.onOutro().onOutroComplete', this.constructor.name, this.props, this.state, this.timeline);
// 				this.handleComplete();
      }
    }).to(this.wrapper, OUTRO_DURATION * 0.5, {
      opacity    : 1.0,
      scale      : 1.0,
      ease       : Back.easeOut,
      onComplete : ()=> {
        console.log('%s.onOutro().onOutroComplete', this.constructor.name, this.props, this.state, this.timeline);
//         this.handleComplete();
      }
    });
	};

	render() {
// 		console.log('%s.render()', this.constructor.name, this.props, this.state, this.timeline);

		if (this.wrapper && this.timeline && this.timeline.time === 0) {
			this.timeline.seek(0);
		}

		const { type, blocking, offset, title, closeable, children } = this.props;
		const wrapperClass = `base-overlay-content-wrapper base-overlay-content-wrapper${(type === OVERLAY_TYPE_PERCENT_SIZE) ? '-percent' : (OVERLAY_TYPE_AUTO_SIZE) ? '-auto-size' : '-auto-scroll'}`;
		const wrapperStyle = (type === OVERLAY_TYPE_POSITION_OFFSET) ? {
			transform  : `translate(${(offset.x || 0)}px, ${(offset.y || 0)}px)`
		} : null;


		return (<div className={`base-overlay${(blocking) ? ' base-overlay-blocking' : ''}`} onClick={(closeable) ? this.handleClose : null}>
			<div className={wrapperClass} style={wrapperStyle} onClick={(event)=> event.stopPropagation()} ref={(element)=> { this.wrapper = element; }}>
				{(title) && (<div className="base-overlay-header-wrapper">
					<div className="base-overlay-title">{title}</div>
				</div>)}
				<div className="base-overlay-content">{children}</div>
			</div>
		</div>);
	}
}


export default onClickOutside(BaseOverlay);
