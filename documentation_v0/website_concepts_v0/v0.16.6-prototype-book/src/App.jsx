import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { mockCards } from './mock-data';

const Card = ({ card, onSelect, isSelected }) => {
  return (
    <motion.div
      layoutId={`card-${card.id}`}
      onClick={() => onSelect(card)}
      className={`relative cursor-pointer transition-shadow duration-300 group ${isSelected ? 'z-50' : 'hover:z-10'
        }`}
      whileHover={{ scale: 1.05, rotateY: 5, rotateX: -5 }}
    >
      <div className="bg-brown-dark border-2 border-gold-dark rounded-lg overflow-hidden shadow-xl aspect-[2/3] flex flex-col">
        {/* Card Header */}
        <div className="bg-gold-deep p-1 flex justify-between items-center border-b border-gold-dark">
          <span className="text-[10px] uppercase font-bold text-gold-light truncate">{card.title}</span>
          <i className="fas fa-gem text-gold-shine text-[8px]"></i>
        </div>

        {/* Card Image */}
        <div className="flex-1 overflow-hidden relative">
          <img src={card.image} alt={card.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        </div>

        {/* Card Body */}
        <div className="p-2 bg-parchment-dark/20 flex-1 flex flex-col justify-between">
          <div className="text-[9px] text-parchment-light italic leading-tight line-clamp-3">
            {card.description}
          </div>
          <div className="flex justify-between items-center mt-1 border-t border-gold-dark/30 pt-1">
            <span className="text-[8px] font-bold text-gold">{card.type}</span>
            <span className="text-[8px] text-parchment-medium">#00{card.id}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const ExpandedCard = ({ card, onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        layoutId={`card-${card.id}`}
        className="w-full max-w-md aspect-[2/3] bg-brown-dark border-4 border-gold rounded-xl overflow-hidden shadow-[0_0_50px_rgba(200,150,10,0.5)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Large Card Header */}
        <div className="bg-gold-deep p-3 flex justify-between items-center border-b-2 border-gold">
          <span className="text-xl uppercase font-bold text-gold-light medieval-font">{card.title}</span>
          <div className="flex gap-2">
            <i className="fas fa-bolt text-gold-shine"></i>
            <button onClick={onClose} className="text-gold-light hover:text-white transition-colors">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        {/* Large Card Image */}
        <div className="flex-[2] overflow-hidden relative border-b-2 border-gold-dark">
          <img src={card.image} alt={card.title} className="w-full h-full object-cover" />
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
            <span className="text-gold-light medieval-font text-sm uppercase tracking-widest">{card.type}</span>
          </div>
        </div>

        {/* Large Card Body */}
        <div className="flex-1 p-6 bg-[url('https://www.transparenttextures.com/patterns/parchment.png')] bg-parchment-light flex flex-col">
          <div className="text-brown-deep text-lg italic leading-relaxed medieval-font">
            "{card.description}"
          </div>
          <div className="mt-auto flex justify-between items-end border-t border-brown-mid pt-4">
            <div className="flex flex-col">
              <span className="text-[10px] text-brown-mid uppercase font-bold">Artist</span>
              <span className="text-xs text-brown-deep font-bold">Unsplash Explorer</span>
            </div>
            <div className="text-brown-mid font-bold medieval-font">
              SET-01 / 012
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};



const BinderPage = ({ cards, onCardSelect, setCards }) => {
  return (
    <Reorder.Group
      axis="y"
      values={cards}
      onReorder={setCards}
      className="grid grid-cols-3 gap-4 p-8 border-4 border-brown-mid rounded-xl shadow-2xl min-h-[600px]"
    >
      {cards.map((card) => (
        <Reorder.Item
          key={card.id}
          value={card}
          className="relative cursor-grab active:cursor-grabbing"
        >
          <Card card={card} onSelect={onCardSelect} />
        </Reorder.Item>
      ))}
    </Reorder.Group>
  );
};

const LargeCard = ({ title, image, description }) => {
  return (
    <div className="w-full h-full p-8 flex flex-col items-center justify-center">
      <div className="w-full max-w-sm bg-brown-dark border-4 border-gold rounded-xl overflow-hidden shadow-2xl flex flex-col">
        <div className="bg-gold-deep p-4 border-b-2 border-gold text-center">
          <h2 className="medieval-font text-gold-light text-xl uppercase tracking-widest">{title}</h2>
        </div>
        <div className="flex-1 overflow-hidden relative border-b-2 border-gold-dark aspect-[3/4]">
          <img src={image} alt={title} className="w-full h-full object-cover" />
        </div>
        <div className="p-6 bg-parchment-light bg-[url('https://www.transparenttextures.com/patterns/parchment.png')]">
          <p className="text-brown-deep italic text-base leading-relaxed medieval-font text-center">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
};

const Bookmarks = () => {
  const tabs = [
    { name: 'Map', icon: 'fa-map' },
    { name: 'Inventory', icon: 'fa-briefcase' },
    { name: 'Character', icon: 'fa-user-shield' },
    { name: 'Journal', icon: 'fa-feather-alt' }
  ];
  return (
    <div className="absolute top-[-44px] left-1/2 -translate-x-1/2 flex gap-2 z-0">
      {tabs.map(tab => (
        <motion.div
          key={tab.name}
          whileHover={{ y: -5 }}
          className="px-4 py-2 bg-brown-mid border-2 border-brown-light border-b-0 rounded-t-lg text-gold-light medieval-font text-[10px] uppercase tracking-widest cursor-pointer hover:bg-brown-warm transition-colors flex items-center gap-2 shadow-lg"
        >
          <i className={`fas ${tab.icon} text-[10px]`}></i>
          {tab.name}
        </motion.div>
      ))}
    </div>
  );
};

function App() {
  const [cards, setCards] = useState(mockCards);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedCard, setSelectedCard] = useState(null);
  const [direction, setDirection] = useState(0);

  const cardsPerPage = 6;
  const totalPages = Math.ceil(mockCards.length / cardsPerPage);

  const paginate = (newDirection) => {
    const nextPage = currentPage + newDirection;
    if (nextPage >= 0 && nextPage < totalPages) {
      setDirection(newDirection);
      setCurrentPage(nextPage);
    }
  };

  const currentCards = cards.slice(
    currentPage * cardsPerPage,
    (currentPage + 1) * cardsPerPage
  );

  const handleReorder = (newOrder) => {
    const updatedCards = [...cards];
    updatedCards.splice(currentPage * cardsPerPage, cardsPerPage, ...newOrder);
    setCards(updatedCards);
  };

  const variants = {
    enter: (direction) => ({
      rotateY: direction > 0 ? 180 : -180,
      opacity: 0,
      transformOrigin: direction > 0 ? "left" : "right",
    }),
    center: {
      rotateY: 0,
      opacity: 1,
      transition: {
        duration: 0.8,
        ease: "easeInOut",
      },
    },
    exit: (direction) => ({
      rotateY: direction > 0 ? -180 : 180,
      opacity: 0,
      transformOrigin: direction > 0 ? "right" : "left",
      transition: {
        duration: 0.8,
        ease: "easeInOut",
      },
    }),
  };

  return (
    <div className="min-h-screen bg-brown-deep flex flex-col overflow-hidden">
      {/* Navbar */}
      <nav className="bg-brown-dark border-b-2 border-gold-dark p-4 flex justify-between items-center shadow-lg sticky top-0 z-40">
        <h1 className="text-3xl medieval-font-decorative text-gold-light tracking-widest drop-shadow-[0_0_10px_rgba(232,184,48,0.5)]">
          PATHS <span className="text-gold">BINDER</span>
        </h1>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2 bg-black/30 px-3 py-1 rounded border border-gold-dark/30">
            <i className="fas fa-book text-gold"></i>
            <span className="text-gold-light medieval-font text-sm uppercase">Collection: 12/250</span>
          </div>
          <button className="bg-gold hover:bg-gold-light text-brown-deep px-4 py-1 rounded font-bold transition-colors medieval-font uppercase text-sm">
            Inventory
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-8 relative bg-[url('https://www.transparenttextures.com/patterns/leather.png')] bg-brown-deep">
        {/* Binder Container */}
        <div className="relative w-full max-w-4xl h-[700px] flex items-center justify-center perspective-[2000px]">

          {/* Bookmarks */}
          <Bookmarks />

          {/* Binder Spine/Background */}
          <div className="absolute inset-0 bg-brown-dark border-8 border-brown-mid rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] flex">
            <div className="w-1/2 border-r-4 border-black/50"></div>
            <div className="w-1/2"></div>
          </div>

          {/* Page Transitions */}
          <div className="relative w-full h-full flex z-10">
            <AnimatePresence initial={false} custom={direction}>
              <motion.div
                key={currentPage}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                className="absolute inset-0 w-full h-full"
                style={{ backfaceVisibility: "hidden" }}
              >
                <div className="flex w-full h-full">
                  {/* Left Page (Large Card) */}
                  <div className="w-1/2">
                    <LargeCard
                      title={`COLLECTION VOLUME ${currentPage + 1}`}
                      image="/binder-cover.png"
                      description="Explore the ancient myths and legends through these enchanted relics. Every card tells a story of the paths chosen and the destinies forged."
                    />
                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-black/20 to-transparent"></div>
                  </div>

                  {/* Right Page (Content) */}
                  <div className="w-1/2 p-4">
                    <BinderPage cards={currentCards} onCardSelect={setSelectedCard} setCards={handleReorder} />
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation Buttons */}
          <div className="absolute bottom-[-60px] flex gap-8 z-20">
            <button
              onClick={() => paginate(-1)}
              disabled={currentPage === 0}
              className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all ${currentPage === 0
                ? 'border-gold-dark/20 text-gold-dark/20 cursor-not-allowed'
                : 'border-gold text-gold hover:bg-gold hover:text-brown-deep shadow-[0_0_15px_rgba(200,150,10,0.3)]'
                }`}
            >
              <i className="fas fa-chevron-left"></i>
            </button>
            <div className="flex items-center text-gold-light medieval-font tracking-widest">
              PAGE {currentPage + 1} / {totalPages}
            </div>
            <button
              onClick={() => paginate(1)}
              disabled={currentPage === totalPages - 1}
              className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all ${currentPage === totalPages - 1
                ? 'border-gold-dark/20 text-gold-dark/20 cursor-not-allowed'
                : 'border-gold text-gold hover:bg-gold hover:text-brown-deep shadow-[0_0_15px_rgba(200,150,10,0.3)]'
                }`}
            >
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </main>

      {/* Expanded Card Modal */}
      <AnimatePresence>
        {selectedCard && (
          <ExpandedCard card={selectedCard} onClose={() => setSelectedCard(null)} />
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="p-4 text-center text-gold-dark/50 text-xs medieval-font uppercase tracking-widest border-t border-gold-dark/10">
        &copy; 2026 PATHS GAME &mdash; TRADING CARD ENGINE
      </footer>
    </div>
  );
}

export default App;
