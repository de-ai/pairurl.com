
import React, { Component } from 'react';
import './PlaygroundNavPanel.css';

import NavPanelTypeGroup from './NavPanelTypeGroup';

class PlaygroundNavPanel extends Component {
	constructor(props) {
		super(props);

		this.state = {
			typeGroups : []
		};
	}

	componentDidMount() {
// 		console.log('%s.componentDidMount()', this.constructor.name, this.props, this.state);

		const typeIDs = this.props.items.map((item)=> (item.typeID));
		const typeGroups = this.props.typeGroups.filter((typeGroup)=> (typeIDs.includes(typeGroup.id))).map((typeGroup)=> {
			return ({ ...typeGroup,
				expanded : false,
				selected : false, // check url for type + id
				items    : this.props.items.filter((item)=> (item.typeID === typeGroup.id)).map((item)=> ({ ...item,
					selected : false // check url for id
				}))
			});
		});
		this.setState({ typeGroups });
	}

	handleTypeGroupClick = (typeGroup)=> {
// 		console.log('%s.handleTypeGroupClick()', this.constructor.name, typeGroup);

		const { typeGroups } = this.state;
		this.setState({
			typeGroups : typeGroups.map((grp)=> ({ ...grp,
				expanded : (grp.id === typeGroup.id) ? !grp.expanded : grp.expanded
			}))
		});
	};

	handleTypeItemClick = (typeGroup, typeItem)=> {
// 		console.log('%s.handleTypeItemClick()', this.constructor.name, typeGroup, typeItem);

		const { typeGroups } = this.state;
		this.setState({
			typeGroups : typeGroups.map((grp) => ({ ...grp,
				expanded : (grp.id === typeGroup.id),
				selected : (grp.id === typeGroup.id),
				items    : grp.items.map((i) => ({ ...i,
					selected : (i.id === typeItem.id)
				}))
			}))
		});
	};


	render() {
// 		console.log('%s.render()', this.constructor.name, this.props, this.state);

		const { team } = this.props;
		const { typeGroups } = this.state;

		return (<div className="playground-nav-panel">
			<PlaygroundNavPanelHeader team={team} />
			<div className="playground-nav-panel-component-type-wrapper">
				{(typeGroups.map((typeGroup, i)=> (<NavPanelTypeGroup key={i} typeGroup={typeGroup} onTypeGroupClick={this.handleTypeGroupClick} onTypeItemClick={this.handleTypeItemClick} />)))}
			</div>
		</div>);
	}
}


const PlaygroundNavPanelHeader = (props)=> {
// 	console.log('PlaygroundNavPanelHeader()', props);

	const { team } = props;
	return (<div className="playground-nav-panel-header">
		<img className="playground-nav-panel-header-logo" src={team.logo} alt="Logo" />
		<div className="playground-nav-panel-header-title">{team.title}</div>
	</div>);
};


export default (PlaygroundNavPanel);
