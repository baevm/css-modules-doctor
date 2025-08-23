import React from 'react'

import containerStyles from './container.css'
import textStyles from './text.css'

export const Component = () => {
  return (
    <div className={containerStyles.container}>
      <p className={textStyles.text}>some random text</p>
    </div>
  )
}
