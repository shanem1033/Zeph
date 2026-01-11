import Modal from './Modal'

export default function FormModal({ isOpen, onClose, onSubmit, title, children }) {
  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(e)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="form">
        {children}
      </form>
    </Modal>
  )
}
