
import React from 'react';
import './PlaygroundBaseComment.css';

import { connect } from 'react-redux';

import { COMMENT_TIMESTAMP } from '../../../../consts/formats';
import { USER_DEFAULT_AVATAR } from '../../../../consts/uris';


function PlaygroundBaseComment(props) {
// 	console.log('PlaygroundBaseComment()', props);

	const { profile, ind, comment } = props;
	const { id, type, author, content, timestamp } = comment;

	return (<div className="playground-base-comment" data-id={id}>
		<div className="playground-base-comment-header-wrapper">
			<div className="playground-base-comment-header-icon-wrapper">
				{(type !== 'init') && (<div className="playground-base-comment-header-icon avatar-wrapper">{ind}</div>)}
				<div className="playground-base-comment-header-icon avatar-wrapper"><img src={(!author.avatar) ? USER_DEFAULT_AVATAR : author.avatar} alt={author.username} /></div>
			</div>
			<div className="playground-base-comment-header-spacer" />
			<div className="playground-base-comment-header-link-wrapper">
				{(profile && profile.id === author.id && type !== 'init') && (<div className="playground-base-comment-header-link" onClick={props.onDelete}>Delete</div>)}
			</div>
		</div>

		<div className="playground-base-comment-timestamp" dangerouslySetInnerHTML={{ __html : timestamp.format(COMMENT_TIMESTAMP).replace(/(\d{1,2})(\w{2}) @/, (match, p1, p2)=> (`${p1}<sup>${p2}</sup> @`)) }} />
		<div className="playground-base-comment-content" dangerouslySetInnerHTML={{ __html : content.replace(author.username, `<span class="txt-bold">@${author.username}</span>`) }} />
	</div>);
}


const mapStateToProps = (state, ownProps)=> {
	return ({
		profile : state.userProfile
	});
};


export default connect(mapStateToProps)(PlaygroundBaseComment);
