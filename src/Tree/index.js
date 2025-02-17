import React from 'react';
import PropTypes from 'prop-types';
import { TransitionGroup } from 'react-transition-group';
import { layout, select, behavior, event } from 'd3';
import clone from 'clone';
import deepEqual from 'deep-equal';
import uuid from 'uuid';

import Node from '../Node';
import Link from '../Link';
import './style.css';

export default class Tree extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      initialRender: true,
      data: this.assignInternalProperties(clone(props.data)),
    };
    this.findNodesById = this.findNodesById.bind(this);
    this.collapseNode = this.collapseNode.bind(this);
    this.handleNodeToggle = this.handleNodeToggle.bind(this);
    this.handleOnClickCb = this.handleOnClickCb.bind(this);
    this.handleOnMouseOverCb = this.handleOnMouseOverCb.bind(this);
    this.handleOnMouseOutCb = this.handleOnMouseOutCb.bind(this);
  }

  componentDidMount() {
    this.bindZoomListener(this.props);
    // TODO find better way of setting initialDepth, re-render here is suboptimal
    this.setState({ initialRender: false }); // eslint-disable-line
  }

  componentWillReceiveProps(nextProps) {
    // Clone new data & assign internal properties
    if (!deepEqual(this.props.data, nextProps.data)) {
      this.setState({
        data: this.assignInternalProperties(clone(nextProps.data)),
      });
    }

    // If zoom-specific props change -> rebind listener with new values
    if (
      !deepEqual(this.props.translate, nextProps.translate) ||
      !deepEqual(this.props.scaleExtent, nextProps.scaleExtent)
    ) {
      this.bindZoomListener(nextProps);
    }
  }

  /**
   * setInitialTreeDepth - Description
   *
   * @param {array} nodeSet Array of nodes generated by `generateTree`
   * @param {number} initialDepth Maximum initial depth the tree should render
   *
   * @return {void}
   */
  setInitialTreeDepth(nodeSet, initialDepth) {
    nodeSet.forEach(n => {
      n._collapsed = n.depth >= initialDepth;
    });
  }

  /**
   * bindZoomListener - If `props.zoomable`, binds a listener for
   * "zoom" events to the SVG and sets scaleExtent to min/max
   * specified in `props.scaleExtent`.
   *
   * @return {void}
   */
  bindZoomListener(props) {
    const { zoomable, scaleExtent, translate } = props;
    const svg = select('.rd3t-svg');
    const g = select('.rd3t-g');

    if (zoomable) {
      svg.call(
        behavior
          .zoom()
          .scaleExtent([scaleExtent.min, scaleExtent.max])
          .on('zoom', () => {
            g.attr('transform', `translate(${event.translate}) scale(${event.scale})`);
          })
          // Offset so that first pan and zoom does not jump back to [0,0] coords
          .translate([translate.x, translate.y]),
      );
    }
  }

  /**
   * assignInternalProperties - Assigns internal properties to each node in the
   * `data` set that are required for tree manipulation and returns
   * a new `data` array.
   *
   * @param {array} data Hierarchical tree data
   *
   * @return {array} `data` array with internal properties added
   */
  assignInternalProperties(data) {
    return data.map(node => {
      node.id = uuid.v4();
      node._collapsed = false;
      // if there are children, recursively assign properties to them too
      if (node.children && node.children.length > 0) {
        node.children = this.assignInternalProperties(node.children);
        node._children = node.children;
      }
      return node;
    });
  }

  /**
   * findNodesById - Description
   *
   * @param {string} nodeId The `node.id` being searched for
   * @param {array} nodeSet Array of `node` objects
   * @param {array} hits Accumulator for matches, passed between recursive calls
   *
   * @return {array} Set of nodes matching `nodeId`
   */
  // TODO Refactor this into a more readable/reasonable recursive depth-first walk.
  findNodesById(nodeId, nodeSet, hits) {
    if (hits.length > 0) {
      return hits;
    }

    hits = hits.concat(nodeSet.filter(node => node.id === nodeId));

    nodeSet.forEach(node => {
      if (node._children && node._children.length > 0) {
        hits = this.findNodesById(nodeId, node._children, hits);
        return hits;
      }
      return hits;
    });

    return hits;
  }

  /**
   * collapseNode - Recursively sets the `_collapsed` property of
   * the passed `node` object and its children to `true`.
   *
   * @param {object} node Node object with custom properties
   *
   * @return {void}
   */
  collapseNode(node) {
    node._collapsed = true;
    if (node._children && node._children.length > 0) {
      node._children.forEach(child => {
        this.collapseNode(child);
      });
    }
  }

  /**
   * expandNode - Sets the `_collapsed` property of
   * the passed `node` object to `false`.
   *
   * @param {type} node Node object with custom properties
   *
   * @return {void}
   */
  expandNode(node) {
    node._collapsed = false;
  }

  /**
   * handleNodeToggle - Finds the node matching `nodeId` and
   * expands/collapses it, depending on the current state of
   * its `_collapsed` property.
   * `setState` callback receives targetNode and handles
   * `props.onClick` if defined.
   *
   * @param {string} nodeId A node object's `id` field.
   *
   * @return {void}
   */
  handleNodeToggle(nodeId) {
    const data = clone(this.state.data);
    const matches = this.findNodesById(nodeId, data, []);
    const targetNode = matches[0];

    if (this.props.collapsible) {
      targetNode._collapsed ? this.expandNode(targetNode) : this.collapseNode(targetNode);
      this.setState({ data }, () => this.handleOnClickCb(targetNode));
    } else {
      this.handleOnClickCb(targetNode);
    }
  }

  /**
   * handleOnClickCb - Handles the user-defined `onClick` function
   *
   * @param {object} targetNode Description
   *
   * @return {void}
   */
  handleOnClickCb(targetNode) {
    const { onClick } = this.props;
    if (onClick && typeof onClick === 'function') {
      onClick(clone(targetNode));
    }
  }

  /**
   * handleOnMouseOverCb - Handles the user-defined `onMouseOver` function
   * 
   * @param {string} nodeId 
   * 
   * @return {void}
   */
  handleOnMouseOverCb(nodeId) {
    const { onMouseOver } = this.props;
    if (onMouseOver && typeof onMouseOver === 'function') {
      const data = clone(this.state.data);
      const matches = this.findNodesById(nodeId, data, []);
      const targetNode = matches[0];
      onMouseOver(clone(targetNode));
    }
  }

  /**
   * handleOnMouseOutCb - Handles the user-defined `onMouseOut` function
   * 
   * @param {string} nodeId 
   * 
   * @return {void}
   */
  handleOnMouseOutCb(nodeId) {
    const { onMouseOut } = this.props;
    if (onMouseOut && typeof onMouseOut === 'function') {
      const data = clone(this.state.data);
      const matches = this.findNodesById(nodeId, data, []);
      const targetNode = matches[0];
      onMouseOut(clone(targetNode));
    }
  }

  /**
   * generateTree - Generates tree elements (`nodes` and `links`) by
   * grabbing the rootNode from `this.state.data[0]`.
   * Restricts tree depth to `props.initialDepth` if defined and if this is
   * the initial render of the tree.
   *
   * @return {object} Object containing `nodes` and `links`.
   */
  generateTree() {
    const { initialDepth, depthFactor, separation, nodeSize, orientation } = this.props;

    const tree = layout
      .tree()
      .nodeSize(orientation === 'horizontal' ? [nodeSize.y, nodeSize.x] : [nodeSize.x, nodeSize.y])
      .separation(
        (a, b) => (a.parent.id === b.parent.id ? separation.siblings : separation.nonSiblings),
      )
      .children(d => (d._collapsed ? null : d._children));

    const rootNode = this.state.data[0];
    const nodes = tree.nodes(rootNode);
    const links = tree.links(nodes);

    // set `initialDepth` on first render if specified
    if (initialDepth !== undefined && this.state.initialRender) {
      this.setInitialTreeDepth(nodes, initialDepth);
    }

    if (depthFactor) {
      nodes.forEach(node => {
        node.y = node.depth * depthFactor;
      });
    }

    return { nodes, links };
  }

  render() {
    const { nodes, links } = this.generateTree();
    const {
      nodeSvgShape,
      orientation,
      translate,
      pathFunc,
      transitionDuration,
      zoomable,
      textLayout,
      nodeSize,
      depthFactor,
      initialDepth,
      separation,
      circleRadius,
      styles,
    } = this.props;

    const subscriptions = { ...nodeSize, ...separation, depthFactor, initialDepth };

    return (
      <div className={`rd3t-tree-container ${zoomable ? 'rd3t-grabbable' : undefined}`}>
        <svg className="rd3t-svg" width="100%" height="100%">
          <TransitionGroup
            component="g"
            className="rd3t-g"
            transform={`translate(${translate.x},${translate.y})`}
          >
            {links.map((linkData, i) => (
              <Link
                key={uuid.v4()}
                orientation={orientation}
                pathFunc={pathFunc}
                linkData={linkData}
                transitionDuration={transitionDuration}
                styles={styles.links}
                debounceTimeout={nodes[i].depth * 25 + i * 30}
              />
            ))}
            {nodes.map((nodeData, i) => (
              <Node
                key={nodeData.id}
                nodeSvgShape={nodeSvgShape}
                orientation={orientation}
                transitionDuration={transitionDuration}
                nodeData={nodeData}
                name={nodeData.name}
                attributes={nodeData.attributes}
                onClick={this.handleNodeToggle}
                onMouseOver={this.handleOnMouseOverCb}
                onMouseOut={this.handleOnMouseOutCb}
                textLayout={textLayout}
                circleRadius={circleRadius}
                subscriptions={subscriptions}
                styles={styles.nodes}
                debounceTimeout={nodeData.depth * 25 + i * 30}
                mapIndex={i}
              />
            ))}
          </TransitionGroup>
        </svg>
      </div>
    );
  }
}

Tree.defaultProps = {
  nodeSvgShape: {
    shape: 'circle',
    shapeProps: {
      r: 10,
    },
  },
  onClick: undefined,
  onMouseOver: undefined,
  onMouseOut: undefined,
  orientation: 'horizontal',
  translate: { x: 0, y: 0 },
  pathFunc: 'diagonal',
  transitionDuration: 500,
  depthFactor: undefined,
  collapsible: true,
  initialDepth: undefined,
  zoomable: true,
  scaleExtent: { min: 0.1, max: 1 },
  nodeSize: { x: 140, y: 140 },
  separation: { siblings: 1, nonSiblings: 2 },
  textLayout: {
    textAnchor: 'start',
    x: 10,
    y: -10,
    transform: undefined,
  },
  circleRadius: undefined, // TODO: DEPRECATE
  styles: {},
};

Tree.propTypes = {
  data: PropTypes.array.isRequired,
  nodeSvgShape: PropTypes.shape({
    shape: PropTypes.string,
    shapeProps: PropTypes.object,
  }),
  onClick: PropTypes.func,
  onMouseOver: PropTypes.func,
  onMouseOut: PropTypes.func,
  orientation: PropTypes.oneOf(['horizontal', 'vertical']),
  translate: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number,
  }),
  pathFunc: PropTypes.oneOfType([
    PropTypes.oneOf(['diagonal', 'elbow', 'straight']),
    PropTypes.func,
  ]),
  transitionDuration: PropTypes.number,
  depthFactor: PropTypes.number,
  collapsible: PropTypes.bool,
  initialDepth: PropTypes.number,
  zoomable: PropTypes.bool,
  scaleExtent: PropTypes.shape({
    min: PropTypes.number,
    max: PropTypes.number,
  }),
  nodeSize: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number,
  }),
  separation: PropTypes.shape({
    siblings: PropTypes.number,
    nonSiblings: PropTypes.number,
  }),
  textLayout: PropTypes.object,
  circleRadius: PropTypes.number,
  styles: PropTypes.shape({
    nodes: PropTypes.object,
    links: PropTypes.object,
  }),
};
