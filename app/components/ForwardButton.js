import React, { Component, PropTypes } from 'react'
import { Link } from 'react-router'

class ForwardButton extends Component {
  static contextTypes = {
    router: React.PropTypes.object.isRequired
  }

  render() {
    return (
      <button className="btn btn-sm nav-page"
        onClick={() => this.context.router.goForward()}>
        {this.props.children}
      </button>
    )
  }
}

export default ForwardButton