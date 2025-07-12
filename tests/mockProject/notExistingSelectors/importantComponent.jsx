import styles from './styles.css'

export const ImportantComponent = () => {
  return (
    <div className={styles.notExisting}>
      <p className={styles.someText}>text</p>
    </div>
  )
}
