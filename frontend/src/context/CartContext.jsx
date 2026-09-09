import React, { createContext, useContext, useState, useMemo } from 'react'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [items, setItems] = useState([]) // { listing_id, product_name, unit, price_per_unit, quantity, available }

  const addItem = (listing, quantity) => {
    const maxAvail = Number(listing.quantity_available) || 0
    if (maxAvail <= 0) return

    setItems((prev) => {
      const existing = prev.find((i) => i.listing_id === listing.id)
      if (existing) {
        return prev.map((i) =>
          i.listing_id === listing.id
            ? { ...i, quantity: Math.min(maxAvail, i.quantity + quantity), available: maxAvail }
            : i
        )
      }
      return [
        ...prev,
        {
          listing_id: listing.id,
          product_name: listing.product_name,
          unit: listing.unit,
          price_per_unit: listing.price_per_unit,
          available: maxAvail,
          quantity: Math.min(maxAvail, Math.max(0.01, quantity)),
        },
      ]
    })
  }

  const updateQuantity = (listingId, quantity) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.listing_id === listingId) {
          const maxAvail = Number(i.available) || 999999
          const clamped = Math.min(maxAvail, Math.max(0.01, Number(quantity)))
          return { ...i, quantity: clamped }
        }
        return i
      })
    )
  }

  const removeItem = (listingId) => {
    setItems((prev) => prev.filter((i) => i.listing_id !== listingId))
  }

  const clearCart = () => setItems([])

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + Number(i.price_per_unit) * Number(i.quantity), 0),
    [items]
  )

  return (
    <CartContext.Provider value={{ items, addItem, updateQuantity, removeItem, clearCart, subtotal }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
