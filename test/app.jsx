import React from 'react'

import styles from './styles.module.css'

const CLASS_NAMES = {
  key: styles.selectorForKey
}

export const app = () => {
  return (
    <div className={styles.randomSelector}>
      <button className={styles.buttonSelector}>btn</button>
      <div className={CLASS_NAMES[key]}>div</div>
    </div>
  )
}
