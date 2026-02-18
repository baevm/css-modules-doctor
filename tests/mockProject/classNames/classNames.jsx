import styles from './styles.module.css'

function cn() {}

export const StageTable = () => {
  return (
    <div
      className={cn(styles.stage, {
        [styles['disabledStage']]: isStageClosed,
        [styles.anotherClass]: isStageClosed,
        [styles.missingClassName]: isStageClosed,
        [styles['missingStringLiteralClass']]: isStageClosed,
      })}>
      test
    </div>
  )
}
