// src/components/cart/CartDrawer.tsx
import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'

interface CartItem {
  id: string
  name: string
  quantity: number
  price: number
}

interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
  items: CartItem[]
  onUpdateQuantity: (id: string, quantity: number) => void
  onRemoveItem: (id: string) => void
}

export default function CartDrawer({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
}: CartDrawerProps) {
  const total = items.reduce((sum, item) => sum + item.quantity * item.price, 0)

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" />
        </Transition.Child>

        <div className="fixed inset-0 flex justify-center items-end sm:items-center">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="translate-y-full sm:translate-y-0 sm:scale-95"
            enterTo="translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leaveFrom="translate-y-0 sm:scale-100"
            leaveTo="translate-y-full sm:translate-y-0 sm:scale-95"
          >
            <Dialog.Panel className="relative bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b flex justify-between items-center">
                <Dialog.Title className="text-lg font-semibold">
                  Your Cart
                </Dialog.Title>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
                  ✕
                </button>
              </div>

              {/* Cart Items */}
              <div className="p-4 max-h-80 overflow-y-auto space-y-4">
                {items.length === 0 ? (
                  <p className="text-gray-500 text-center">Your cart is empty</p>
                ) : (
                  items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center border rounded-lg p-3"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-500">
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                        >
                          −
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                          className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                        >
                          +
                        </button>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => onRemoveItem(item.id)}
                        className="ml-3 text-red-500 hover:text-red-700"
                      >
                        🗑
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                <button
                  disabled={items.length === 0}
                  className="w-full mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300"
                >
                  Proceed to Checkout
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  )
}