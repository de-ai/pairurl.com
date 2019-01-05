
import React, { Component } from 'react';
import './UploadTreeItem.css';

import { Row } from 'simple-flexbox';

import { limitString } from '../../utils/funcs';
import sketchIcon from '../../images/icon-sketch.png';

const UPLOAD_CHAR_LIMIT = 26;
const CATEGORY_CHAR_LIMIT = 23;
const INNER_CHAR_LIMIT = 20;


function CategoryTreeItem(props) {
	const textClass = (props.selected) ? 'tree-item-text tree-item-text-selected' : 'tree-item-text';

	return (
		<div className="category-tree-item">
			<div className={textClass} onClick={()=> props.onClick()}>{limitString(props.title, CATEGORY_CHAR_LIMIT)}</div>
			{(props.selected) && (<div className="category-tree-item-list">
				{props.items.map((item, i)=> {
					return (
						<InnerTreeItem
							key={item.id}
							title={item.title}
							selected={item.selected}
							onClick={()=> props.onInnerClick(props.id, item)} />
					);
				})}
			</div>)}
		</div>
	);
}


function InnerTreeItem(props) {
	const textClass = (props.selected) ? 'tree-item-text tree-item-text-selected' : 'tree-item-text';

	return (
		<div className="inner-tree-item">
			<div className={textClass} onClick={()=> props.onClick()}>{limitString(props.title, INNER_CHAR_LIMIT)}</div>
		</div>
	);
}


class UploadTreeItem extends Component {
	constructor(props) {
		super(props);

		this.state = {
			categories : [{
				id       : 1,
				title    : 'Fonts',
				selected : false,
				items    : props.fonts
			}, {
				id       : 2,
				title    : 'Colors',
				selected : false,
				items    : props.colors
			}, {
				id       : 3,
				title    : 'Symbols',
				selected : false,
				items    : props.symbols
			}, {
				id       : 4,
				title    : 'Views',
				selected : window.location.pathname.includes('/artboard'),
				items    : props.pages
			}, {
				id       : 5,
				title    : 'Contributors',
				selected : false,
				items    : props.contributors
			}]
		};
	}

	static getDerivedStateFromProps(nextProps) {
		return ({ title : limitString(nextProps.title, UPLOAD_CHAR_LIMIT) });
	}

	handleCategoryClick = (category)=> {
		console.log('handleCategoryClick()', category);
		let categories = [...this.state.categories];
		categories.forEach((item)=> {
			if (category.id === item.id) {
				item.selected = !item.selected;

			} else {
				item.selected = false;
			}

			if (!item.selected) {
				item.items.forEach((i)=> {
					i.selected = false;
				});
			}
		});

		this.props.onCategoryClick(category);
		this.setState({ categories });
	};

	handleInnerClick = (id, item)=> {
		console.log('handleInnerClick()', id, item);

		if (id === 1) {
			this.props.onFontClick(item);

		} else if (id === 2) {
			this.props.onColorClick(item);

		} else if (id === 3) {
			this.props.onSymbolClick(item);

		} else if (id === 4) {
			this.props.onPageClick(item);

		} else if (id === 5) {
			this.props.onContributorClick(item);
		}
	};

	render() {
		const { selected } = this.props;
		const { title, categories } = this.state;

		const textClass = (selected) ? 'tree-item-text tree-item-text-selected' : 'tree-item-text';

		return (
			<div className="upload-tree-item">
				<Row vertical="center">
					<img src={sketchIcon} className="upload-tree-item-icon" alt="Icon" />
					<div className={textClass} onClick={()=> this.props.onClick()}>{title}</div>
				</Row>
				{(selected) && (<div className="upload-tree-item-list">
					{categories.map((category, i)=> {
						return (
							<CategoryTreeItem
								key={i}
								id={category.id}
								title={category.title}
								items={category.items}
								selected={category.selected}
								onClick={()=> this.handleCategoryClick(category)}
								onInnerClick={(id, item)=> this.handleInnerClick(id, item)}
							/>
						);
					})}
				</div>)}
			</div>
		);
	}
}

export default UploadTreeItem;
