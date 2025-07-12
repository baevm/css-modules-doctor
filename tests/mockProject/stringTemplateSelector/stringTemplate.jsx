import React from 'react'

import styles from './styles.css'

export const SomeComponent = () => {
  return (
    <div
      className={`${styles.firstClassName} ${someCondition ? styles.superUniqueUsedClassname : ''}`}>
      SomeComponent
    </div>
  )
}
