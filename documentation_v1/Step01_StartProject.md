# AlNao Paths Game V1 - Step 01: Start the project

This document defines the **start project steps** to build a **AlNao Paths Game**, an playable web-based game called AlNaoPathsGame, with detailed requirements and scope for a V1 release.

> note : document in italian language, traslation coming soon! 

---

ciao, voglio creare un gioco che si chiamaerà AlNaoPathsGame,
- repository https://github.com/alnao/AlNaoPathsGame 
	- "game-frontend-web" in react e bootstrap5 e fontawesome 7 (Free)
	- "game-backend" in java spring boot 3.5.x, con main package "it.alnao.pathsGame", userà database PostgreSQL/SqlLite, espone API rest standard con JWT, poi vedremo se serviranno altri servizi
	- "admin-web" in react e bootstrap5 e fontawesome 7 (Free)
	- "admin-backend"  in java spring boot 3.5.x, con main package "it.alnao.pathsAdmin", userà database PostgreSQL/SqlLite, espone API rest standard con JWT, poi vedremo se serviranno altri servizi
- regole di gioco di un librogame con regole prese da gdr, gameboard e giochi di carte (analisi funzionale)
	- i giocatori devono essere registrati come utenti, eseguono login con username e password, le API di gioco sono sicurizzate con JWT, sarà da predisporre anche il single-sign-on con google
		- questo è un gioco a "partite" dove un numero di giocatori può iscriversi alla partita se non iniziata o un giocatore può avviare la registrazione di una nuova partita, c'è un limite di partite attive come parametro1=NumeroMassimoPartiteAttiveNelloStessoMomento 
		- il primo giocatore può far partire la partita prima che sia piena oppure la partita parte in automatico quando si è raggiunta la capienza massima (la capienza massima è numeroGiocatoriMassimo a seconda della difficoltà scelta della partita)
		- quando un giocatore crea la partita seleziona la storia e difficoltà tra quelle disponibili per la storia
		- gli utenti partecipanti ad una partita non può cambiare, se si disconnette il tempo continua in attesa che torni (altri personaggi continuano azioni e turni)
		- quando un utente si aggiunge alla partita sceglie quale personaggio giocare (che si aggiuge alla partita) poi sceglie la classe, personaggio e le caratteristiche (la somma dei costi dei costo è determinata dalla storia e dalla difficoltà)
	- il gioco è di tipo "librogame" scandito da tempo (giorni/ore/clock), eventi, scelte, movimenti, luoghi, ...
		- ogni partita prevede un registro unico per partita: chiamato "registro delle annotazioni" (chiave1=valore1, chiave2=valore2, ) e oggetti (oggetto1, oggetto2)
		- tutto il registro (annotazioni e oggetti) sono del tipo SI/NO oppure numerico,
		- esempio di registro "IlReMorto"=SI/NO, "TrovatoColtello"=SI/NO, "Oggetto Coltello"=SI/NO, "NumeroColtelli"=1,2,3 "Capitolo="1,3,..5" "Giorno="1,2,3,4"...
		- una eventuale concetto di "capitolo" (a volte detta anche fase) viene gestita tramite il registro, per esempio "Capitolo=4" "Fase=2" che il gioco è nel capitolo 4 fase 2
	- ogni personaggio ha punteggio intero di : energia, vita, tristezza, esperienza (che parte da zero) che varia in base a scelte, situazioni e passare del tempo
		- energia e tristezza non possono mai superare vita, i valori massimi MAI SUPERABILI di energia, vita e tristezza sono definiti nell'elenco dei "possibili personaggi"
		- ogni personaggio ha uno zaino: quantità cibo, quantità magia, quantità ricchezza (minimo 0), inoltre ha un elenco di oggetti consumabili che possono essere trovati nel corso della partita
		- ogni personaggio ha statistiche intere di: destrezza, intelligenza, costituzione (minimo 1), all'inizio della partita i valori sono determinati nell'elenco "possibili personaggi"
		- ogni personaggio ha una classe (mago, ladro, forestale, elfo, nano, stregone, paladino, chierico, guardia, bambino, vecchio) - prevedere un "elenco classi"
		- ogni classe da un bonus: ad inizio partita si applica un modificatore somma di "elenco classi" e  "possibili personaggi"
		- ogni classe da un bonus: ad ogni inizio di tempo il personaggio recuperare/guadagnare una statistica definita nel  "elenco classi"
		- ogni personaggio ha il suo inventario di oggetti consumabili, può scambiare oggetti o può scambiare cibo,magia,richezza con altri personaggi se si trova nello stesso luogo e se entrambi non sono addormentati/in coma
		- gli oggetti consumabili possono essere usati in qualsiasi momento durante il suo turno purchè il personaggio non sia dormendo  e non sia in coma
			- in qualunque momento durante il suo turno un oggetto consumabile può essere scartato o inviato ad un altro personaggio non addormentato e non in cooma nello stesso luogo (per evitare il peso massimo), gli scartati spariscono dal gioco!
			- ogni oggetto consumabile ha un peso, un giocatore ha un peso massimo trasportabile in base alla classe: massimo = il valore di costituzione + parametro del gioco in base alla difficoltà + capienza_zaino_default
			- la somma di cibo+magia+ricchezza+somma peso Oggetti=capienza massima dello zaino = peso massimo trasportabile
			- nota: nel gioco esiste anche il concetto di oggetto fisso (non consumabile) ma verrà gestito tramite il registro e non tramite oggetti/inventario/peso
			- nota: se per qualche motivo un personaggio ha un peso maggiore del peso massimo trasportabile non si può muovere
		- esempio: utente sceglie personaggio "alberto classe programamtore" che ha inizalmente vitaMassima=10, DES=4, INT=4, COS=2, energiaMassima=6, tristezzaMassima=4, pesoMassimo=10
	- quando un personaggio si addormenta in un luogo sicuro può spendere un valore esperienzaCosto di esperienza per aumentare di uno una tra DES, INT e COS, il valore esperienzaCosto è un parametro della partita (difficoltà)
		- ogni personaggio all'inizio della partita sceglie tra una lista di allineamento/caratteristiche (legale, neutrale, cautico, buono, cattivo, bello, introverso, brutto, lista nel global_runtime_variables), che può cambiare durante la partita solo a seconda degli eventi ma non su scelta dell'utente
	- avanzamento gioco: è basato su tempo (numero intero che inizia da uno)
		- i personaggi si muovono in tabellone di luoghi (luogo1, luogo2, ecc...), essendoci può personaggi si possono muovere in luogi diversi anche dividendosi, c'è limite di personaggi in un luogo (in una stanza massimo 4 personaggi, in un bosco massimo 2000 personaggi)
		- un tempo termina quando tutti i personaggi hanno zeri energia oppure si addormentano volontariamente
		- ogni tempo ha un "meteo", che determina il "costo di movimento", tabella di elenco_meteo_regole, ad inizio tempo c'è un nuovo meteo casuale tra quelli possibili, regole di casualita viste dopo
		- esempio: al primo giorno tutti i personaggi si trovano nel luogo 1=Città e il tempo è bello, si addormentano, inizia il secondo giorno e inizia a piovere
	- ogni lo scandire del tempo, gli eventi e le scelte possono modificare lo stato dei giocatori secondo queste regole
		- se un personaggio scende a 0 o meno di energia non può fare azioni, se ha energia può fare azioni anche più volte e anche più movimenti, quando ha zero energia si addormenta
		- quando il valore di tristezza raggiunge quello di vita, il personaggio perde un valore di vita pari alla sua COS e torna a zero di tristezza e si addormenta immediatamente
		- se un persionaggio scende a 0 o meno di vita si addormenta immediatamente e cade in coma! (è considerato in coma ma anche addormentato)
		- all'inizio di ogni tempo, se il personaggio è in luogo sicuro guadana il valore DES+P di energia, COS+P di vita e perde INT+P di tristezza, se non si trova in luogo sicuro guadagna solo DES di energia, P è un parametro sicurezza del luogo in cui si trova il personaggio
		- i personaggi non addormentati agiscono in ordine, se vuole un giocatore può passare il turno senza fare nulla e senza spendere energia, quando l'ultimo giocatore passa si ritorna la primo giocatore non addormentato
		  - un giocatre può fare più azioni finchè ha energia durante il suo turno, un giocatore ha un tot di secondi poi in automatico il sistema passa al successivo (anche se chiude browser/app)
		  - l'ordine di esecuzione è calcolato con la formula_ordine ad inizio di ogni tempo, il più alto agisce per primo, in caso di parità si usa id_personaggio_istanza
		  - se tutti passano e hanno ancora energia, il giro ricomincia finché tutti non si addormentano, prevista tabella specifica gioco_coda_turni per indicare l'ordine
		  - voglio un WebSocket che indica quando è il turno di un personaggio, si crea una sorta di loop ma si evita il loop infiti con un contatore nella gioco_coda_turni, ogni volta che si passa si incrementa, il tempo a disposizione aumenta
		  - esempio: persionaggio1 fa due azioni poi passa, personaggio2 fa una azione e si addormenta perchè fine energia, personaggio3 passa, personaggio1 fa un'altra azione poi passa, poi agisce personaggio3 con tre azioni e si addormenta, poi personaggio1 azione con ultima energia e si addormenta, tutti addormentati quindi fine tempo
		- ogni volta che inizia un tempo si scatena in automatico un evento (esempio: i personaggi si svegliano nel bosco quando inizia a piovere e arriva un cerbiatto)
		- personaggi in coma possono essere "salvati" da un altro personaggio nello stesso luogo che usa una energia per dare COS ad comatoso oppure da oggetti consumabili che danno vita
	- ogni luogo identificato da un numero (e un nome e descrizione e immagine) ha:
		- costo di energia per entrare è una caratteristica variabile del luogo, si somma sempre il costo dovuto al meteo (per ora fisso per luogo e non dipende da registro)
		- ci può essere un evento automatico quando un personaggio entra per la prima volta (si scatena in automatico e non costa energia)
		- ci può essere un evento automatico quando un personaggio entra dalla seconda volta (si scatena in automatico e non costa energia)
		- ci può essere un evento automatico quando un personaggio entra e non ci sono già altri personaggi all'interno (si scatena in automatico e non costa energia)
		- ci può essere un evento automatico quando un personaggio inizia il tempo in questo luogo (si scatena in automatico e non costa energia)
		- lista eventi/incontri facoltativi (possono avere un costo specifico per evento)
		- ogni luogo ha una lista esplicita di "vicini" (es. Da Luogo A un personaggio può muoversi verso LuogoB e LuogoD, ma non luogoC)
		- ogni movimento tra vicini da Luogo1 a Luogo2 è possibile a seconda di condizioni in base al registro 
		  - esempio: il pg si trova in corridoio che ha due porte, il movimento verso la camera è disponibile se nel registro PortaCameraAperta=SI altrimenti la porta è chiusa e il movimenton non è possibile!
		- movimento di gruppo: se più giocatori si trovano nello stesso luogo e uno di questi si muove in un altro luogo, gli altri si possono muovere con lui GRATIS senza spendere in energia (azione follow)
		  - Il movimento di gruppo è l'unica azione che può avvenire fuori turno (giocatori si possono muovere mentre un altro giocatore sta agendo, evento e scelte rimangono al giocatore che sta agendo)
		- un luogo può prevedere un counter_tempo_iniziale, se definito il luogo rimane attivo per quel numero di tempo, quando il counter arriva a zero il luogo scatena solo il "evento_se_bloccato" (esempio un capanno in fiamme ha un tempo per essere ispezionato)
	- "evento": ogni evento ha un costo di energia che un personaggio deve spendere se vuole scatenare quell'evento (quelli automatici hanno sempre zero), altrimenti "l'evento termina". Ogni evento può (anche più d'uno):
		- un evento ha un costo_ricchezza. se il personaggio non ha abbastanza ricchezza non può eseguire l'evento, la ricchezza viene poi scalata quando l'evento si verifica
		- un evento può modificare un registro (esempi: evento "scassinare una porta" imposta nel registro "portaAperta=SI", evento "rubare dal portafoglio" imposta nel registro "Soldi = Soldi + 10").
		- un evento può causare la fine del tempo" dove tutti i personaggi si addormentano (esempio: i giocatori mangiano cibo avvelenato, si sentono male e si addormentano)
		- un evento può aggiungere o rimuovere un oggetto consumabile se c'è posto nell'inventario (esempio: aperto un cassetto trovano un coltello che si aggiunge nell'inventario del personaggio)
		- un evento ha sempre una descrizione/testo da leggere (esempio: entri nella stanza e noti che c'è un armadio chiuso; percorrendo la strada trovi un carretto abbandonato)
		- un evento può avere una scelta da fare dopo aver fatto i precedenti oppure "l'evento termina") (esempio: c'è un cassetto, scelta di aprirlo oppure termina)
		- un evento può cambiare il tempo definito da un campo "meteo_causato", (per esempio un personaggio lancia un incantesimo che scatena la pioggia > meteo pioggia)
		- un evento può cambiare la posizione dei personaggi posizionandoli in altro luogo senza pagare il costo del movimento (esempio entri in stanza ma il pavimento crolla e i personaggi si ritrovano nella cantina)
		- un evento può modificare i dati di vita, tristezza, cibo, magia, ricchezza (in positivo o in negativo ma nessun dato può andare sotto zero o superare i limiti di vita, tristezza e peso)
		- un evento può aggiungere o rimuovere una caratteristica del personaggio (rimuove se presente, aggiunge se possibile compatibilità con la classe)
		- quando si verifica un evento, si rifersce sempre a tutti i personaggi che si trovano in quel luogo (esempio trappola causa un danno a tutti i pg che si trovano in quel luogo)
		- può essere eseguito anche più volte per partita (una trappola può scattare più volte)
	- "scelta" se l'evento o il luogo lo prevede ci possono essere più opzioni disponibili
		- il personaggio attivo può eseguire una scelta tra le opzioni diponibili, ogni opzione ha un ordine di esecuzione, in quelle automatiche sono eseguite in ordine (la prima vera vince sulle altre)
		- ci possono essere più opzioni per luogo/evento, esempio : scelta1 vai al eventoP (apri la finestra) oppure scelta2 vai al eventoQ (tira le tende)
		- ogni opzione ha una regola di "attivazione" cioè può essere selezionata se si verificano tutte le condizioni configurate che possono essere del tipo
			- limite di tristezza: una opzione ha un valore massimo tristezza, se il giocatore ha più di quella tristezza non può scegliere quella opzione
			- limite di DES/INT/COS: una opzione ha un valore minimo di DES/INT/COS, se il giocatore ha meno di quella caratteristica non può scegliere quella opzione
			- divieto di caratteristica: una scelta ha un valore VIETATO, se il giocatore ha quella caratteristica non può scegliere (esempio scelta rubare non attiva per i legali)
			- obbligo di caratteristica: una scelta ha un valore OBBLIGATORIO, solo se il giocatore ha quella caratteristica può scegliere qella opzione altrimenti non è selezionabole attiva (esempio sedurre solo per i belli)
			- Condizioni Multiple (AND/OR): Nelle opzioni, le condizioni (es. Oggetto H e/o Luogo F) , operatore_logico_condizioni indica se le condizioni sono in AND O in OR (per una scelta sono tutte in AND oppure sono tutte in OR, per ora non c'è un mix)
		- quando una opzione viene scelta scatta un "effetto" che può essere del tipo
			- se tutti i personaggi si trovano in un nuovo specifico allora vai ad un idEvento
			- se nel registro una chiave ha un determinato valore vai ad un idEvento
			- se il giocatore che ha causato l'evento ha un oggetto consumabile specifico vai ad idEvento
			- se nel luogo corrente c'è almeno un personaggio con una classe specifica vai ad un idEvento
			- se somma(caratteristica_giocatori_in_luogo) > valore allora vai ad un idEvento (esempio: non posso aprire questa porta da solo, il Mago è debole, serve il Guerriero forte)
			- se luogo specifico allora vai al idEvento
		- ci può essere una scelta "altrimenti" (senza limite e senza condizioni), in una scelta ci possono essere più opzioni dello stesso tipo, ogni opzione ha un ordine , ogni scelta può avere un solo altrimenti
		- nota: ogni scelta ha una sola opzione come risultato che può portare ad un solo evento come risultato, una scelta non consuma energia (ma l'evento che ha scatenato la scelta può averlo fatto)
		- se l'utente ha più scelte, il client dovrà mostrre le scelte possibili dando la possiblità di scegliere una tra queste con timeout, in caso di timeout si sceglie l'opzione "altrimenti" se presente, altrimenti non si sceglie nulla e l'evento termina
	- missioni: sono gestite tramite registro e scelte
		- durante la storia i personaggi potranno accettare di eseguire delle missioni (per esempio i personaggi possono accettare di salvare la figlia di un mercante, ottenendo nel registro "figlia mercante=DA SALVARE")
		- con eventi e scelte possono ricevere "figlia mercante"="SALVATA" o ="MORTA", tornando dal mercante possono ricevere ricompensa un oggetto consumabile se salvata!
		- prevedere una tabella missioni e missioniStep che si basano sul registro di gioco
- cose che mancano che saranno aggiunte in una seconda versione, per ora NON DEVONO ESSERE MAI PRESE IN CONSIDERAZIONE
	- NPG erranti o NPC statici (esempio un luogo può avere un mercante fisso) oppure un personaggio errante!
	- la morte definitiva e/o il gameover : c'è solo il coma di gruppo che scatena un evento
	- Una variabile interna che cresce quando il player fa troppe azioni nello stesso tempo e influisce su probabilità/energia (anche se non visibile). servirà per evitare spam di azioni
	- Usa un seed per partita così gli eventi casuali sono riproducibili (utile per replay/debug e fairness)
	- Sistema TutorialOverlay e “First-Time Hint”: La prima volta che scatta un tipo di evento (es. Coma, Scambio), invia una notifica tutorial automatica ai player.
	- Registro multi-valore: Permetti chiavi che memorizzano liste (es. “Luoghi visitati”). Non è un booleano o numero, ma un array. Utile per narrazione.
	- Segnali tra giocatori: Un sistema di ping rapido (tipo “Seguimi”, “Pericolo qui”, “Serve aiuto”) senza chat testuale.
	- Eventi muti: Eventi che non danno testo narrativo immediato, ma solo effetti.
	- Rumore e furtività: Ogni azione rumorosa aumenta un contatore di rumore nel luogo → sblocca eventi negativi (esempio stanza )
	- Rituali di gruppo: Azioni che richiedono più personaggi nello stesso luogo (somma statistiche >= soglia) per sbloccare eventi speciali.
	- Missioni a tempo: Missioni che scadono dopo X tempi (non è solo registro statico).
	- Sistema di voto: Prima di un evento critico, i player votano una scelta (se più giocatori nello stesso luogo).
	- Stanchezza del luogo: Un luogo visitato troppe volte diventa “sterile”: meno eventi utili, più eventi vuoti.
	- Regola anti‑stall: Se per N minuti non succede nulla, il server genera un micro‑evento (“ti annoi… perdi 1 energia”).
	- controllo/blocco loop infiniti per evitare che tutti i personaggi passino nonostante abbiano energia
	- evento STALEMATE_WARNING Se tutti passano tranne l'ultimo, avvisa l'ultimo: "Se passi anche tu, perderete tutti energia!".
	- gioco_personaggi_equipaggiamento: per ora tutti gli oggetti sono ecquipaggati ed usabili sempre, non sono previste limitazione di utilizzo 
	- per utente : quando un personaggio finisce partita guadagna qualcosa che può usare nelle successive partite (cosmetici, progressi, exp inizial)
	- modalità spettatore ed export diario storia, rating/vote storie e partite, 
	- modalità analista: quali luoghi/event/scelte i personaggi muoiono? quanti time prima che un giocatore abbandoni partita? scelte mai fatte? eventi mai success? luoghi mai scoperti!
	- gestione mani/zaino: per ora i personaggi possono usare oggetti nello zaino quando vogliono, azione mani dove si possono mettere due oggetti e "azione gratuita" per scambiare oggetti
	- "azione gratuita": ogni personaggio per tempo ha un numero di azioni gratuite che saranno: oggetti mano/zaino, eventi specifici, usare un oggetto, scambio, movimento di gruppo. previsto già campo numero_max_azione_gratuita_al_tempo
	- effetti temporanei come "Per le prossime 2 azioni hai +1 DES", "Sei paralizzato fino al Tempo 5", intanto messa tabella che verrà usata in futuro!
- note aggiuntive e parametri necessari
	- MatchFormulaOrdine = (DES*3 + INT*2 + COS*1) * 1000 + VITA*10 + ID
	- NumeroMassimoPartiteAttiveNelloStessoMomento 
	- TimeoutPlayerPass tempo in secondi di base (per esempio 60 secondi)
	- TimeoutPlayerPassPerVolta (per esempio 60 secondi)
	- TimeoutTradesExpire tempo in secondi
	- TimeoutMovementFollow tempo in secondi
	- TimeoutScelte tempo in secondi
	- TimeBetweenMessages tempo in secondi
	- SystemStatus (nella global_runtime_variables OK/KO ) , possiblità di bloccare l'inizio di una partita per esempio per offline del sistema!
- ipotesi tabelle database (postgresql/sqlite/mysql)
	- global_runtime_variables: id, tipo, chiave, valore, descrizione, valore, valore_minimo, valore_massimo. (da intendere come parametri_globali, comprese anche le possibili caratteristiche)
	- utenti: id, username, password_hash, email, google_sub_id (per SSO), ruolo (ADMIN/PLAYER), data_registrazione, data_ultimo_accesso, nome, utenza_esterna, stato (REGISTRATO,ATTIVO,BLOCCATO,PASSWORD_SCADUTA), lingua
	- utenti_tokens: id, id_utente, refresh_token, expires_at, revoked
	- elenco_storie: id, id_carta, titolo, descrizione_breve, autore, versione, id_luogo_iniziale, id_immagine. id_luogo_coma_gruppo, id_evento_coma_gruppo, data_creazione, data_ultima_modifica, tempo_singolare, tempo_plurale (giorni/ore/giri), evento_tutti_in_coma, evento_partita_terminata
	- elenco_storie_difficoltà: id, id_carta, id_storia, descrizione, esperienzaCosto, pesoMax, parametroSicurezza, numeroGiocatoriMassimo, parametroDifficoltaMassima, costoEnergiaAiutoComatoso, costoMaxCaratteristiche, numero_max_azione_gratuita_al_tempo
	- elenco_chiavi: id, id_carta, id_storia, nome_chiave (es. 'NumeroPartiteAttiveNelloStessoMomento' no multilingua), valore, descrizione_id_testo (chiavi resti della storia, ex parametri_globali)
	- elenco_classi: id, id_carta, id_storia, nome_classe_id_testo (Mago, Ladro, etc.), descrizione_id_testo, peso_massimo_trasportabile_base, bonus_iniziale_destrezza, bonus_iniziale_intelligenza, bonus_iniziale_costituzione
	- elenco_classi_bonus: id, id_carta, id_storia, id_classe, statistica_influenzata (Energia, Vita, etc.), valore_bonus, descrizione.
	- elenco_caratteristiche: id, id_carta, id_storia, id_classe_possibile, id_classe_vietata, nome, descrizione, costo (intero anche negativo)  (esempio: bello, buono, carrivo, bello non permesso ai nani, basso permesso solo ai bambini e ai nani)
	- elenco_personaggi_tipi_possibili: id_tipo, id_carta, id_storia, nome_template, descrizione_id_testo, vita_max, energia_max, tristezza_max, destrezza, intelligenza, costituzione
	- elenco_luoghi: id, id_carta, id_storia, nome_id_testo, narrativo_id_testo, id_immagine, is_luogo_sicuro (boolean), costo_energia_base, counter_tempo_iniziale, evento_se_bloccato, parametro_sicurezza, evento_se_giocatore_inizia_day, evento_se_giocatore_entra_per_primo, evento_se_prima_volta, evento_se_successive_volte, costo_energia_entrata, ordine_eventi_automatici, audio_background_url, numero_massimo_personaggi_nel_luogo
	- elenco_luoghi_vicini: id, id_storia, id_luogo_partenza, id_luogo_destinazione, direzione=NORD/SUD/ESD/OVEST/SOPRA/SOTTO/CIELO , is_bidirezionale (boolean), condizione_passaggio_chiave, condizione_passaggio_valore, costo_energia_extra (default 0, in salita potrebbe costare di più!), descrizione_movimento_andata_id_testo, descrizione_movimento_ritorno_id_testo
	- elenco_oggetti: id, id_carta, id_storia, nome_id_testo, descrizione_id_testo, peso, is_consumabile
	- elenco_oggetti_effetti : id, id_oggetto, id_storia, descrizione_id_testo, effetto_codice (es. "VITA"), effetto_valore (esempio 2)
	- elenco_meteo_regole: id, id_carta, id_storia, titolo_id_testo, narrativo_id_testo, peso_probabilità, costo_movimento_luogo_sicuro, costo_movimento_luogo_non_sicuro, condizione_chiave_registro, condizione_valore, tempo_da, tempo_a, icona_url, attivo, priorità, delta_energia_tempo, id_evento_scatenato
	- elenco_eventi: id, id_carta, id_storia, id_luogo, titolo_id_testo, narrativo_id_testo, tipo_evento (AUTOMATICO_ENTRATA_1, AUTOMATICO_ENTRATA_2, INIZIO_tempo, FACOLTATIVO, PRIMO_GIOCATORE), descrizione_testo, costo_energia, causa_fine_tempo (boolean), caratteristica_daaggiungere, caratteristica_darimuovere, registro_chiave, registro_valore, id_oggetto_da_aggiungere, meteo_causato, interrompi_successivi, costo_ricchezza
	- elenco_eventi_effetti: id, id_carta, id_evento, statistica (MOVIMENTO, VITA, ENERGIA, ESPERIENZA...), valore, target (TUTTI_IN_LUOGO, CHI_HA_ATTIVATO), target_classe, target_oggetto_richiesto (esempio Entri nella stanza e il soffitto crolla con -1 vita a tutti, trappola magica colpisce solo il mago)
	- elenco_scelte: id, id_carta, id_storia, id_evento / id_luogo, ordine_esecuzione, titolo_id_testo, narrativo_id_testo, id_evento_risultato, limite_tristezza, limite_des, limite_int, limite_cos,, is_altrimenti (boolean), is_progresso (se is progresso=true allora insert nella gioco_trama_progresso), operatore_logico_condizioni (AND/OR)
	- elenco_scelte_condizioni: id, id_scelta, tipo_condizione (REGISTRO, OGGETTO, CLASSE, LUOGO, POSIZIONE_TUTTI, SOMMA_CARATTERISTICA, CARATTERISTICA), chiave_confronto, valore_confronto, operatore_confronto (uguale,maggiore,minore,diverso), descrizione_id_testo
	- elenco_scalte_effetti: id, id_scelta, effetto_di_gruppo=true/false, statistica (VITA, ENERGIA, TRISTEZZA, DES, COS, INT,CARATTERISTICA), valore_delta (+5, -3), descrizione_id_testo
	- elenco_global_random_events: id, id_carta, id_storia, condizione_chiave_registro, condizione_valore, probabilita_attivazione , descrizione_id_testo, id_evento
	- elenco_missioni: id, id_carta, id_storia, condizione_chiave_registro, condizione_valore_iniziale, condizione_valore_finale, titolo_id_testo, descrizione_id_testo
	- elenco_missioni_step: id, id_carta, id_storia, id_missione, ordine_step, condizione_chiave_registro, condizione_valore, titolo_id_testo, descrizione_id_testo, id_immagine
	- elenco_carta: id univoco, id_Storia, id_immagine, lingua, url_immagine, testo_id_testo, descrizione_id_testo, costoA
	- elenco_testi: id univoco, id_Storia, id_label, lingua, testo, descrizione (per le traduzioni in più lingue)
	- gioco_partite: id, id_storia, nome, difficolta_scelta, esperienzaCosto, stato (CREATA, IN_CORSO, PAUSA, TERMINATA, TERMINATA_GAMEOVER), tempo_corrente, meteo_corrente, id_utente_creatore, data_inizio, lock_expiration_timestamp, gameover_timestamp, id_personaggio_turno_corrente, turno_scadenza_ts, parametro_sicurezza, contatore_passaggi_consecutivi
	- gioco_personaggi_istanza: id, id_partita, id_utente, id_personaggio_template, energia_attuale, vita_attuale, tristezza_attuale, id_luogo_corrente, is_addormentato (ATTIVO, ADDORMENTATO, COMA), tempo_in_coma, tempo_ultimo_pass , numero_pass_consecutivi 
	- gioco_personaggi_caratteristiche: id_personaggio_istanza, caratteristica (lista di bello, buono, alto, nerd, ... )
	- gioco_zaino_risorse: id_personaggio_istanza, quantita_cibo, quantita_magia, quantita_ricchezza.
	- gioco_inventario_oggetti: id, id_personaggio_istanza, id_oggetto, quantita_totale, quantita_disponibile = quantita_totale - quantita_bloccata.
	- gioco_stato_registro: id, id_partita, chiave, valore_stringa, valore_numerico (per gestire sia SI/NO che contatori).
	- gioco_effetti_attivi: id_effetto_attivo, id_partita, id_personaggio, is_attivo, is_visibile, energia_effetto, vita_effetto, tristezza_effetto, inizio_tempo, fine_tempo, tipo_effetto, stackabile, titolo, descrizione, trigger_momento = ON_TIME_START (esempio avveleneato dal tempo 3 al tempo 5 perde 1 vita all'inizio di ogni tempo)
	- gioco_stato_luoghi: id_partita, id_luogo, gia_attivato=true/false, counter_tempo
	- gioco_coda_turni: id_partita, id_personaggio_istanza, timestamp_inizio_turno, timestamp_fine_turno ,numero_pass, ordine_turno (calcolato ogni tempo in base a formula_ordine, il più alto agisce per primo, in caso di parità si usa id_personaggio_istanza, quando uno si addormenta viene rimosso da questa tabella) 
	- gioco_scelte_attive (id, id_partita, id_personaggio, id_scelta, timestamp_scadenza)
	- gioco_scelte_eseguite: id_scelta , id_partita , tempo , id_personaggio , esito_scelta , timestamp
	- gioco_trama_progresso: id_nodo_trama_corrente, id_partita , tempo_attuale , id_scelta, opzione_scelta , progressione_sbloccata, descrizione (per determinare quali blocchi narrativi sono stati completati, e cosa succede dopo)
	- gioco_log_eventi: id, id_partita, id_personaggio_istanza, timestamp, descrizione_azione, id_evento_scatenato id_scelta_eseguita, tipo_messaggi (usata anche per i passi)
	- gioco_log_oggetti_uso_log: id, id_partita, id_personaggio_usatore, id_oggetto, tempo, effetti_applicati (JSON), timestamp  (Impedire abusi es. "Ho usato 100 pozioni in 1 secondo?".)
	- gioco_log_meteo: id, id_partita, tempo, id_meteo, timestamp_inizio, timestamp_fine
	- gioco_log_movimenti: id, id_partita, id_personaggio, id_luogo_partenza, id_luogo_destinazione, tempo, costo_energia_pagato, meteo_al_momento, timestamp (Utile per analisi statistica "Quale percorso viene fatto più spesso?" e per il replay.)
	- gioco_chat_messages: id_partita, id_utente, id_personaggio, messaggio, timestamp
	- gioco_utente_sessioni: id, id_utente, id_partita, last_seen, is_online, client_id, ip, device (per gestire afk, e  “in azione” vs “in attesa”)
	- gioco_lock_history: id, id_partita, id_personaggio, lock_start, lock_end, reason, esito
	- gioco_tempo_history: id, id_partita, tempo, meteo, inizio_ts, fine_ts, evento_iniziale_id
	- gioco_scambi: id, id_partita, id_utente_proponente, id_utente_destinatario, id_oggetto_offerti, oggetti_richiesti, stato (PENDING_VALIDATION e FAILED_INVALID e REFUSED), scadenza, tipo_risorsa (CIBO/MAGIA/RICCHEZZA), quantita_offerta, quantita_richiesta
	- gioco_notification_queue (id univoco, push di sistema, la chat sarà a livello di partita, campo ts che da priorità, target sempre tutti i giocatori della partita)
	- gioco_movimenti_inviti (id, id_partita, id_utente_invitante, id_utente_invitato, stato=PENDING/ACCEPTED/EXPIRED/CANCELLED, timestamp_creazione, tempo_scadenza, risposta_timestamp, usato_da_ids, costo_energia) per gestire inviti a muoversi insieme anche se non la volevo fare la IA insiste
	- gioco_snapshot (id, id_partita, tempo, tipo=FULL/LIGHT, dati in formato JSONB, obsoleto_rif_snapshot_mongo, obsoleto_rif_file, nome, ts, altri campi se necessari)
	- gioco_variabili_temporanee: id, id_partita, id_personaggio, chiave, valore, scadenza_tipo (TEMPO/AZIONE/TIMESTAMP), scadenza_valore (in futuro "Per le prossime 2 azioni hai +1 DES", "Sei paralizzato fino al Tempo 5")
	
- ipotesi Rest-API (Non mostrare tutti i luoghi vicini se non sono mai stati visitati)
	- auth e utenti (auth)
		- POST /api/auth/register: Registrazione nuovo utente.
		- POST /api/auth/me/changePassword: Registrazione nuovo utente.
		- POST /api/auth/me/changeData: Registrazione nuovo utente.
		- POST /api/auth/login: Login standard (restituisce il JWT).
		- POST /api/auth/google: Scambio del token Google per un JWT interno.
		- GET /api/auth/me: Profilo dell'utente loggato e statistiche storiche.
	- storie e partite (stories e games) 
		- GET /api/stories: Elenco delle storie disponibili (id, titolo, descrizione).
		- GET /api/stories/{id}/characters: Elenco dei personaggi selezionabili per quella storia.
		- GET /api/stories/{id}/lingua/{lingua}/testo/{id_testo}
		- GET /api/stories/{id}/lingua/{lingua}/carta/{id_immagine}
		- GET /api/games/active: Elenco delle partite in attesa di giocatori (filtrate per stato CREATA).
		- POST /api/games/{id}/leave: Se la partita non è ancora iniziata (CREATA): rimuove il personaggio. Se è IN_CORSO: marca il personaggio come ABBANDONATO
		- POST /api/games: Crea una nuova partita (parametri: idStoria, difficoltà).
		- POST /api/games/{id}/join: L'utente si iscrive alla partita.
		- POST /api/games/{id}/start: Il creatore forza l'avvio della partita prima della capienza massima.
		- GET /api/games/{id}/state: Carica lo stato completo (meteo, registro, tempo, posizioni di tutti, elenco giocatori e giocatore attivo).
		- POST /api/games/{id}/select-character: Scelta del personaggio prima dell'inizio.
		- DELETE /api/games/{id}: Permetti agli admin di terminare o annullare manualmente le partite corrotte o stalle.
	- stato del gioco gioco (game)
		- GET /api/game/{id}/players: lista aggiornata dei giocatori (avatar, stato online/offline, classe) utile per la "WaitingRoomPage" e per la "PartyList
		- GET /api/game/{id}/players/{playerId}/stats: dettaglio di tutte le statistiche di un personaggio comprese caratterstiche, stati, effetti, zaino, ... 
		- GET /api/game/{id}/characters/{id}: Dettagli granulari di un personaggio + statistiche.
		- GET /api/game/{id}/locations: ritorna tutti i luoghi già attivati gioco_stato_luoghi
		- GET /api/game/{id}/locations/{locationId}: ritorna tutti i luoghi già scoperti di una storia
		- GET /api/game/{id}/missions/active: elenco missioni attive
		- GET /api/game/{id}/missions/{missionId}/progress: dettaglio di una secondaria attiva!
		- GET /api/game/{id}/stream/{tipo}: Traspone eventi passivi (meteo, messaggi)
		- GET /api/game/{id}/turnOrder: Ritorna la coda turni completa (gioco_coda_turni) con ordine e stato (attivo/addormentato). Utile per il frontend per mostrare "Chi agisce dopo di me?".
		- GET /game/{id}/missionProgress: Ritorna lo stato delle missioni attive confrontando registro con elenco_missioni_step. Utile per UI "Quest Log".
		- GET /api/gameplay/{id_game}/events/{eventId}/details : testo narrativo, requisiti, costo energia, effetti previsti ed eventuali scelte/opzioni possibili e impossibili!
		- GET /api/game/{id}/events/history?limit=100
	- azioni di gioco (gameplay) 
		- POST /api/gameplay/{id_game}/movements/start: Sposta il personaggio (parametri: idLuogoDestinazione). *(1)
		- GET /api/gameplay/{id_game}/movements/pending: Lista degli inviti di movimento di gruppo in sospeso per tutti i personaggi della partita
		- POST /api/gameplay/{id_game}/movements/confirm-movement-invite: api usata da un personaggio per seguire un altro personaggio che si è mosso (parametri: idPersonaggioDaSeguire)
		- POST /api/gameplay/{id_game}/action/ask-help: Chiedi aiuto a un altro personaggio nello stesso luogo (parametri: idPersonaggioAiutante) *(1) -> manda messaggio di aiuto
		- POST /api/gameplay/{id_game}/action/help-player: api usata da un personaggio per aiutare un altro (se si trova nello stesso luogo e se ha abbastanza energia)
		- POST /api/gameplay/{id_game}/action/interact: Scatena un evento facoltativo o interagisce con un oggetto del luogo. *(1)
		- POST /api/gameplay/{id_game}/action/choice: Invia la risposta a una "Scelta" (parametri: idScelta)  *(1)
		- POST /api/gameplay/{id_game}/action/sleep: Il personaggio decide di addormentarsi volontariamente *(1) questo cambia il id_personaggio_turno_corrente
		- POST /api/gameplay/{id_game}/action/pass: (tipo ent-turn) Passa il turno senza fare nulla. con verifica id_personaggio_turno_corrente, questo cambia il id_personaggio_turno_corrente e aumenta/verifica il contatore_passaggi_consecutivi, se contatore_passaggi_consecutivi>PARAMETRO -> gameover
		- GET  /api/gameplay/{id_game}/inventory: Contenuto dello zaino e peso attuale e il peso attuale (di tutti i personaggi)
		- POST /api/gameplay/{id_game}/inventory/use-item: Usa un oggetto consumabile (parametri: idOggetto) *(1)
		- POST /api/gameplay/{id_game}/inventory/send-drop-item per inviare a qualcuno o droppare un oggetto *(1)
		- POST /api/gameplay/{id_game}/inventory/trade: Proponi uno scambio (parametri: idDestinatario, item, quantità), il destinatario riceve messaggio topic TRADE *(1)
		- DELETE /api/gameplay/{id_game}/inventory/trade/{tradeId}: Se cambia idea e vuole annullare il trade!
		- GET /api/gameplay/{id_game}/inventory/trades/pending: per scambi pendenti (sent e received)
		- POST /api/gameplay/{id_game}/inventory/trade/{tradeId}/accept-reject: Un giocatore accetta una proposta di scambio (parametri: idDestinatario, item, quantità) *(1)
		- POST /api/gameplay/{id_game}/character/use-exp: Salva l'aumento di caratteristica spendendo esperienza durante il sonno (parametri: statisticaDaAumentare) *(1)
	- chat e gestione (gamechat)
		- GET /api/gamechat/{id_game}/chat: Quando un utente fa refresh della pagina o entra dopo 10 minuti, deve poter scaricare lo storico della chat via REST
		- GET /api/gamechat/{id_game}/chat?limit=100&before=timestamp
		- POST /api/gamechat/{id_game}/chat: invia messaggio chat ma controlla timestamp ultimo messaggio (minimo distanza tra due messaggi = TimeBetweenMessages)
		- GET /api/game/{id}/notifications
		- GET /api/game/{id}/notifications/unread
		- POST /api/game/{id}/notifications/{notificationId}/mark-read
	- admin (admin)
		- GET /api/admin/params: Gestione della tabella parametri_gioco
		- GET /api/game/{id_game}/replay per visualizzare cronologia completa
		- GET /api/admin/game/{id_game}/log con filtri: tempo, player, evento.Recupera tutta la cronologia della partita per debug o replay.
		- GET /api/admin/game/{id_game}/snapshot
		- PUT /api/admin/game/{id_game}/snapshot/{id} esegue il recupero di una shapshot
		- POST /api/admin/game/{id_game}/register chiama chiaveRegistroAggiungi (id_partita, chiave, valore)
		- POST /api/admin/game/{id_game}/force-unlock per sbloccare una situazione di lock, ricalcola un nuovo giorno e riparte tutto
		- POST /api/admin/game/{id_game}/kick/{user_id} serve eventualmente per bloccare un utente, termina tutte le partite dove c'era e basta!
	- tutte quelle con *(1) = con verifica id_personaggio_turno_corrente e eventualmente aggiorno contatore_passaggi_consecutivi
- WebSocket "coda rigorosa" e azioni che influenzano tutti, le API REST da sole non bastano. WebSocket per notificare gli eventi in tempo reale:
	- Topic: /topic/game/{id_game}
		1. PLAYER_JOINED: Un nuovo giocatore è entrato nella partita/lobby.
		2. TURN_UPDATE: Questo messaggio deve partire ad ogni cambio di turno o cambio ordine (pass). (ex TURN_LOCKED e TURN_FREE: L'azione è finita, la coda è libera.)
			   ```json
			   {
				 "type": "TURN_UPDATE",
				 "currentTurn": {
				   "characterId": 101,
				   "characterName": "Gandalf",
				   "deadlineTimestamp": "2023-10-27T10:00:45Z"
				 },
				 "queueOrder": [101, 102, 103], // Ordine visivo per il client
				 "consecutivePasses": 2, // Se arriva a N -> penalità
				 "isStalemateWarning": true // Avviso grafico se rischio stallo
			   }```
		3. GAME_EVENT: "Piove!", "Il Giocatore B ha attivato una trappola: tutti perdono 1 Vita". Questa ricausa nel frontend una refresh di personaggi/luoghi/eventi/...
		4. DAY_END: Tutti i personaggi hanno dormito, inizia un nuovo tempo
		5. TRADE: Richiesta di scambio oggetto (entro X secondi può confermare altrimenti è negata)
		6. TRADE_EXPIRED
		7. CHAT: Sistema con il quale i giocatori possono parlare e discutere (è un gioco coperativo!)
		8. SYSTEM_MESSAGE
		9. LOCK_EXPIRED
		10. PLAYER_DISCONNECTED
		11. PLAYER_RECONNECTED
		12. STATE_SYNC ```{ "currentTurn": {...},"myCharacter": {...},"allCharacters": [...], "lastEvents": [...],"pendingChoice": {...},"pendingTrades": [...],"pendingMovementInvites": [...] }```
		13. CHOICE_TIMEOUT_WARNING {"secondsLeft": 10}
		14. REGISTRY_UPDATED {  "type": "REGISTRY_UPDATED",  "key": "PortaAperta",  "newValue": "SI"}
	- prevedere un Timeout del Lock lato server. Se giocatore non completa una azione entro X secondi, il server rilascia il lock forzatamente e "l'evento termina", energia spesa non rimborsata, registro modificato rimane così e il personaggio di addormenta in automatico!
	- il movimento di gruppo è istantaneo per chi lo fa, gli altri giocatori ricevono avviso da TURN_UPDATE e hanno X secondi per cliccare "Segui" scatenando l'api "follow"
- service java (oltre ai CRUD di tutte le tabelle), alcui sono solo di utilità ma servono! (per ogni vediamo quali hanno una API che serve)
	- auth e utenti
	1. userRegister: registra utente: per la registrazione di un utente
	2. userListPerMatch
	3. userChangeInformation
	4. userChangePassword
	- games
	5. gamesFormulaOrdine(elenco personaggi)
	6. gamesNumeroMassimoPartiteAttiveNelloStessoMomento()
	7. gamesTimeoutPlayerPass()
	8. gamesStories (ritorna la lista storie)
	9. gamesStory (ritorna il dettaglio di una storia con metodi specifici per classi, personaggi, luoghi, oggetti, meteo, eventi)
	10. gamesCards (elenco carte e elenco testi)
	11. gamesStoryValidation(id_storia) Ritorna un report con errori/warning di una storia
	- match
	12. matchCreate inizia partita: per creare riga in gioco_partite e aspettare che vengano create i personaggi
	13. matchAddPlayer aggiungi personaggio a partita (id_personaggio_tipo_possibile, classe) che influsce IM
	14. matchStart avvia partita e inizio primo tempo e primo evento!
	15. matchListNonStared : ritorna la lista delle partite CREATA ma non in CORSO ( anche le altre?)
	16. matchListUtente(id_utente) tutte le partite di un utente	
	17. matchChageStatus(id_partita, stato) la IA propone un metodo per mettere in pausa o far partire/ripartire una partita
	18. matchAquireLock(id_partita,id_personaggio) la IA propone scrive nella nella gioco_lock_history, serve per evitare problemi di concorrenza, usata per gestire nel websocket chi sta agendo, acquisisci un lock su Redis (SETNX game:{id}:lock:char:{id} {timestamp} EX 10). Se fallisce, ritorna errore "Azione in corso".
	19. matchReleaseLock(id_partita,id_personaggio) la IA propone scrive nella nella gioco_lock_history, serve per evitare problemi di concorrenza usata per gestire nel websocket chi sta agendo
	- registro e missioni
	20. chiaveRegistroAggiungi (id_partita, chiave, valore)
	21. chiaveRegistroLista (id_partita)	
	22. missionsStatus(id_partita): Ritorna JSON con tutte le missioni e loro progressione.
	- personaggio
	23. personaggioValoriLimiti (id_partita, id_personaggio) ritorna INT,DES,COS,CIBO,MAGIA,RICCH,ELENCO_OGGETTI,FLAG e i limiti , flag che indica se il peso è troppo alto! e tutti gli effetti attivi
	24. personaggioAddValues(id_partita, id_personaggio, energia, tristezza, vita int, des, cos , cibo, magia , ricch) e verifica limiti!
	25. personaggioAddExp(id_partita,id_personaggio,quantita_exp)
	26. personaggioAddExp(id_partita,quantita_exp) aggiunge exp a tutti i personaggi della partita
	27. personaggioSpendiEsperienza(id_partita,id_personaggio,des,int,cos) sempre in base al esperienzaCosto
	28. personaggioAddCaratteristica(id_partita,id_personaggio, id_caratteristica)
	29. personaggioRemoveCaratteristica(id_partita,id_personaggio, id_caratteristica)
	30. personaggioHelpComatoso(id_partita,id_personaggio_aiutante,id_personaggio_coma,id_oggetto) personaggi in coma possono essere "salvati" da un altro personaggio nello stesso luogo che usa una energia oppure da oggetti consumabili che danno vita, verifica stesso luogo e che costa energia in base alla difficoltà
	31. personaggioAddEffetto(id_partita,id_personaggio, tipo_effetto, durata_tempo, valore)
	32. personaggioRemoveEffetto(id_partita,id_personaggio, tipo_effetto)
	- zaino
	33. zainoAdd(id_partita, id_personaggio, cibo,magia,ricchezza,id_oggetto)
	34. zainoRemove(id_partita, id_personaggio, cibo,magia,ricchezza,id_oggetto)
	35. zainoProponiScambio(id_partita,id_personaggio_mittente,id_personaggio_destinatario,id_oggetto)
	36. zainoAccettaScambio(id_partita,id_personaggio_mittente,id_personaggio_destinatario,id_oggetto,id_proposta_scambio)
	37. zainoRifiutaScambio(id_partita,id_personaggio_mittente,id_personaggio_destinatario,id_oggetto,id_proposta_scambio)
	38. zainoUsaOggetto(id_partita,id_personaggio,id_oggetto)
	39. zainoGettaOggetto(id_partita,id_personaggio,id_oggetto)
	40. zainoVerificaOggettoSeCapienzaInZaino(id_partita,id_personaggio,id_oggetto) solo di verifica se oggetto prendibile da personaggio
	- matchRunning
	41. matchAddBonusInizioTempo(id_partita,id_personaggio,id_meteo,tempo) non serve id_classe perchè se la prende da solo
	42. matchSpleep(id_partita,id_personaggio) un personaggio scegliere di addormentarsi (o ha finito energia)
	43. matchCheckSleep(id_partita) verifica se ci sono personaggi con energia<=0 allora li addormenta
	44. matchGetPersonaggioAttivo(id_partita) per il websocket , ricalcola chi è attivo, se senza energia passa al successivo
	45. matchPass(id_partita, id_personaggio) usato per un giocatore che passa, aggiorna il numero_pass e aggiorna prossimo giocatore con timestamp_inizio_turno, timestamp_fine_turno=timestamp_inizio_turno + TimeoutPlayerPass + TimeoutPlayerPassPerVolta*numero_pass
	46. matchAllEventDisponibile(id_partita) in base alla posizione dei personaggi ritornare l'elenco degli eventi disponibili e l'elenco dei luoghi vicini possibili (e magari anche quelli non disponibili)
	47. matchSecondarie(id_partita) ritorna tutte le missioni attive con i le varie descrizioni e gli stati
	- time
	48. timeStart(id_partita,meteo_new) metodo che modifica le tabelle
	49. timeCalcolaMeteoNew(id_partita,giorno_nuovo) calcola un nuovo meteo senza salvare nulla e ritorna meteo_new
	50. timeAddBonusClasse(id_partita,id_personaggio) data la classe e tipo aggiunge valori al personaggio
	51. timeAddBonusLuogoInizioGiornata(id_partita) per ogni giocatore in luogo sicuro personaggioAddValues(energia=DES+P,vita=COS+P,tristezza=-INT-P), se non si trova in luogo sicuro personaggioAddValues(energia=DES), P=parametro_sicurezza del luogo in cui si trova
	52. timeEnd(id_partita) metodo di utilità quando tutti i personaggi sono a zero energia o stanno dormento che poi lancia la timeStart()
	53. timeCalcolaOrdineEsecuzione: svuota tabella gioco_coda_turni (id_partita, id_personaggio_istanza, ordine_turno) e ripopola con elenco personaggi con ordine determinato da formula_ordine (In caso di parità si aggiunge id_personaggio)
	54. timeStartDayEventiNeiLuoghi (id_partita) per ogni luogo con almeno un giocatore eventExec(id_parita,evento_se_giocatore_inizia_day)
	- spazi
	55. spaceMoveIntoCheck(id_partita,id_personaggio_principale) verifica se il movimento è possibile (come regole vicini e costo energia e verifica stato precedente), in caso affermativo invia notifica agli altri giocatori che possono accettare o meno di muoversi secondo le regole, poi si chiama il spaceMoveInto
	56. spaceMoveFollow(id_partita,id_personaggio_principale,id_personaggio_assieme) da chiamare quando un personaggio sceglie l'azione follow per seguire un movimento
	57. spaceMoveInto(id_partita,id_personaggio_principale,id_personaggi_assieme): execMoveInto 
	58. spaceList(id_partita,id_luogo) lista di tutti gli eventi disponibili in questo luogo (se presenti personaggi) e la lista delle scelte
	59. spaceFindShortestPath(id_partita, id_luogo_start, id_luogo_end) "Qual è il percorso più breve da Luogo A a Luogo Z?" (Dijkstra) e AI dei NPC
	- matchCheck
	60. checkIfAllPersonaggiInLuogo(id_partita,id_luogo) verifica se tutti sono in quel luogo e ritorna quelli che ci sono e quelli che non ci sono
	61. checkStatoPersonaggi(id_partita) verifica se tutti stanno dormendo, se ci sono a zero di energia imposta addormentati e timeEnd usando la checkIfPersonaggioStanco
	62. checkIfPersonaggioStanco(id_partita,id_personaggio) se zero energia imposta addormentato e ritorna addormentato! usando la checkIfPersonaggioTriste
	63. checkIfPersonaggioTriste(id_partita,id_personaggio) se triste>vita imposta vita=vita-COS e zero tristezza
	64. checkIfPersonaggioComa(id_partita,id_personaggio) se vita<0 imposta addormentato e in coma (è considerato in coma ma anche addormentato)
	65. .checkIfTuttiInComa(id_partita) se tutti in coma allora immediatamente execEvent(evento_tutti_in_coma della storia)
	66. checkVerifyIntegrity(id_partita) verifica integrità di zaino, energia negativa, dati negativi, 
	67. checkMissionProgress(id_partita, id_personaggio): Confronta registro con condizione_valore_finale e aggiorna stati missioni.
	- snapshot
	68. snapshotCreate(id_partita, tipo, nome) prende tutte le tabelle e salva le righe con id_partita in tabella (tipo json in un mongo)
	69. snapshotRestore(id_partita, snapshot_id) snapshotCreate, poi cancella tutte le righe (per id_partita) e poi ripristina tutte le righe (per id_partita)
	70. snapshotList(id_partita, tempo_da, tempo_a)
	- notification
	71. notificationPush(id_partita, target_type, target_id, tipo, messaggio, priority)
	72. notificationMarkAsRead(id_utente, notification_id)
	- exec
	73. execEvents (id_partita,id_luogo,id_eventi) vedi sotto
	74. execScelta 
	75. execStartNewTime (...)
	- scheduled
	76. @Scheduled matchPersonaggioPassTimeout(id_partita) un giocatore ha un tot di tempo (parametro TimeoutPlayerPass) superato quel tempo si passa  con messaggio TURN_UPDATE
	77. @Scheduled cleanExpiredTrades: cancella i trade scaduti e manda nel WebSocket TRADE_EXPIRED ai giocatori coinvolti in base al parametro TimeoutTradesExpire
	78. @Scheduled checkTimeCleanUpAFKPlayers: controlla gioco_utente_sessioni per utenti inattivi da più di X minuti, li marca come offline e invia WebSocket PLAYER_DISCONNECTED
	79. @Scheduled utilsFullSnapshot: salva uno snapshot completo della partita ogni X tempo (per backup/rollback), Archivia o cancella partite con stato = TERMINATA più vecchie di X tempo
	80. @Scheduled utilsStatistichs Aggiorna statistiche storiche degli utenti (partite giocate, vittorie, tempo sopravvissuti).
	81. @Scheduled utilsSaveLightSnapshotDaily: salva uno snapshot leggero della partita (solo delta) alla fine di ogni tempo
	82. @Scheduled utilsCleanOrphanSessions: Cancella gioco_movimenti_inviti con tempo_validita < tempo_corrente
	83. @Scheduled matchCheckLockExpiration: Controlla se lock_expiration_timestamp è scaduto senza azioni, sblocca la partita forzatamente e logga in gioco_lock_history.
	84. @Scheduled utilsCleanOrphanWebSocketSessions: Rimuove record da gioco_utente_sessioni se la connessione WebSocket non esiste più o il client_id non corrisponde a nessuna sessione attiva.
	85. @Scheduled matchSendPendingNotifications: Preleva notifiche da gioco_notification_queue, le ordina per priority, deduplica per hash_deduplica, le invia via WebSocket SYSTEM_MESSAGE e le marca come inviate.
	86. @Scheduled matchCleanExpiredMovementInvites: Cancella gioco_movimenti_inviti oltre tempo_validita in base al TimemoutMovementFollow
	87. @Scheduled timeDailyGameProgression: processo tempo di avanzamento = "inizio tempo", analizzare se serve veramente!
	88. @Scheduled checkTimeoutScelte: in caso di timeout di una scelta nella partita si sceglie l'opzione "altrimenti" se presente, altrimenti non si sceglie nulla e l'evento termina
	- exec
	89. execMoveInto sposta i personaggi calcolando il costo e poi esegue gli eventi con eventExec (evento_se_giocatore_entra_per_primo, evento_se_prima_volta, evento_se_successive_volte) , esecuzione degli eventi con ordine ordine_eventi_automatici
		- verifica se possibile
			- verifica peso del personaggio / dei personaggi
			- verifica se il movimento è possibile per regole elenco_luoghi_vicini
		- eventExec (evento_se_giocatore_entra_per_primo, evento_se_prima_volta, evento_se_successive_volte) , esecuzione degli eventi con ordine ordine_eventi_automatici
	90. execEvents(id_paritita,id_luogo,id_eventi,id_personaggio)
		- cicla per ogni evento ed esegue la execEvent (si interrompe se il precedente ha ritornato flag interrompi eventi successivi)
	91. execEvent(id_paritita,id_luogo,id_evento,id_personaggio)
	- 91a eventTerminePartita: se id_evento===evento_partita_terminata imposta fine partita e continua
	- 91b eventCostEnergia
		- verifica il costo di energia: se non ha abbastanza energia si l'evento si ferma (si interrompe con un bel return e flag interrompi eventi successivi)
		- verifica il costo in ricchezza (se costo_ricchezza>0): se non ha abbastanza ricchezza l'evento si ferma
		- decremento dell'energia (visto che c'è) e continua
		- decremento della ricchezza (se costo_ricchezza>0)
		- se causa_fine_tempo allora chiamare timeEnd che imposta a zero energia e via! flag interrompi eventi successivi
	- 91c eventApplyEffects
		- se in base alla elenco_eventi_effetti allora personaggioAddValues
		- se caratteristica_daaggiungere, caratteristica_darimuovere allora personaggioAddCaratteristica/personaggioRemoveCaratteristica
	- 91d eventModifyRegistry
		- se registro_chiave, registro_valore allora chiaveRegistroAggiungi
		- se elenco_eventi_effetti="MOVIMENTO" allora spaceMoveInto e space (capire come)
		- se meteo_causato allora timeSet e flag interrompi eventi successivi
	- 91e eventAddObject
		- se id_oggetto_da_aggiungere allora zainoVerificaOggettoSeCapienzaInZaino e zainoAdd
	- 91f eventTriggerChoice		
		- ritorno descrizione/testo, elenco scelte e flag interrompi eventi successivi
	92. execScelta (id_paritita, in base al id_luogo o id_evento, id_Scelta, id_personaggio, ...)
	- nota: se is_altrimenti (è sempre possibile) senza verifiche
	- 92a verifica condizioni limite_tristezza, limite_des, limite_int, limite_cos, limite_tristezza, limite_des, limite_int, limite_cos
	- 92b verifica condizione nella elenco_scelte_condizioni e operatore_logico_condizioni (tutte devono essere verificate) altrimenti ritorno non possibile 
	- 92c personaggioAddValues in base al elenco_scalte_effetti (se effetto_di_gruppo su tutti i personaggi nel luogo)
	- 92d check is_progresso (se is progresso=true allora insert nella gioco_trama_progresso)
	- 92e eventExec ( id_evento_risultato ) se valorizzato altrimenti return "l'azione termina"
	93. execStartNewTime(id_paritita)
	- 93a checkTerminato (se una partita è terminata ritorna senza fare nulla)
	- 93b regole fine giorno
		- checkAddormentati verifica che tutti i giocatori siano addormentati (zero energia) se non lo sono imposta zero
		- WebSocket DAY_END
		- log salvo snapshot leggero della partita (solo delta)
		- gioco_movimenti_inviti cancella tutto
		- resetto turno_scadenza_ts e id_personaggio_turno_corrente
	- 93c incrementi/riduzione
		- incremento numero tempo (in memoria e in tabella tempo_corrente in gioco_partite )
		- tutti giocatori recuperano vita, tristezza, energia in base alle regole
		- Riduce durata_tempo in gioco_effetti_attivi; se arriva a zero, rimuove l'effetto.
		- Riduce counter_tempo dei luoghi ogni tempo; se arriva a zero, scatena evento_se_bloccato (decrementLocationCounters)
		- Applica danni/benefici di gioco_effetti_attivi con trigger_momento = ON_DAY_START ogni inizio tempo (applyDailyEffects) e cancella quelle terminate
		- Aumenta tempo_in_coma per personaggi in COMA; messaggio in chat che un utente sta morendo (checkComaDeath)
		- resetto contatore_passaggi_consecutivi a zero
	- 93d verifiche 
		- Verifica game over: se tutti i personaggi sono in coma o contatore_passaggi_consecutivi > PARAMETRO -> termina partita con stato GAMEOVER
	- 93e nuovi eventi (lista)
		- calcolo nuovo meteo casuale (generateDailyWeather): dalla lista dei meteo validi, applica peso probabilità, aggiorna meteo corrente in gioco_partite_attive e invia GAME_EVENT via WebSocket
		- Verifica condizioni di elenco_global_random_events, lancia dado probabilità, lista eventi add random_Event
		- se il meteo prevede un id_evento_scatenato allora lista eventi add id_evento_scatenato
		- timeStartDayEventiNeiLuoghi per aggiungere alla lista eventi i evento_se_giocatore_inizia_day dei luoghi che hanno almeno un personaggio
		- ricostruisco gioco_coda_turni in base a formula MatchFormulaOrdine delle priorità con calcolo id_personaggio_turno_corrente
		- ritorno lista eventi e lista turni
	- 93f invio a giocatori
		- WebSocket GAME_EVENT per nuovo meteo e evento inizio tempo
		- WebSocket TURN_UPDATE per il primo giocatore
		- Preleva notifiche da gioco_notification_queue e le invia via WebSocket, deduplica per hash.
		- puliziaPlayer: Rimuove record da gioco_utente_sessioni se last_seen più vecchio di X minuti.
	- additional
	94. un'interfaccia ConditionChecker con implementazioni specifiche (RegistryConditionChecker, StatConditionChecker, etc.) che il service cicla dinamicamente. 
	95. inmporter : processo che da uno json/yaml popola tutte le tabelle "elenco_" mettendo gli id correntti come chiavi esterne!
- possibile frontend-web(react con bootstrap5 e ultima versione di fontawesome) 
	- messaggio iniziale: da dato questo gioco, voglio iniziare a pensare alla parte grafica del frontend-web, dammi la lista dei component che faresti, dammi solo elenco senza pensare al codice
	- idea di base: essendo ispirato ad un librogame voglio farlo a mo di libro e di raccoglitore di carte, tipo raccoglitore di carte magic/pokemon
		- ogni personaggio è un raccoglitore : prima pagina carta personaggio con classe e tipo, le altre pagine sono elenco effetti, elenco caratteristiche, elenco oggetti zaino
		- raccoglitore del registro : lista carte raccolte per ogni voce nel registro
		- raccoglitore di missioni: ogni missione e step ha una carta (una missione carta e una missione per step)
		- la mappa invece è una griglia dove le carte dei luoghi viene posizionata (i luoghi ci sono anche sopra/sotto/cielo)
	- Elenco Componenti Frontend (React)
		- Autenticazione e Utente
		1. LoginForm – Form di login con username/password
		2. RegisterForm – Form di registrazione nuovo utente
		3. GoogleSSOButton – Bottone per login con Google
		4. UserProfile – Schermata profilo utente con statistiche storiche
		5. ChangePassword – Modale per cambio password
		6. ChangeDataModal – Modale per modifica dati utente
		- Lobby e Gestione Partite
		7. GameLobby – Pagina principale con lista partite disponibili
		8. GameList – Lista delle partite attive/non iniziate
		9. GameCreationForm – Form per creare una nuova partita (scelta storia e difficoltà)
		10. GameInfoCard – Card con info partita (titolo, difficoltà, giocatori)
		11. WaitingRoom – Pagina di attesa prima dell'inizio partita
		12. PartyList – Lista giocatori iscritti alla partita con avatar e stato online/offline
		- Selezione Personaggio e Classe
		13. CharacterSelection – Componente per scegliere personaggio e classe
		14. CharacterCard – Card singola per visualizzare un personaggio (come carta Magic/Pokemon)
		15. ChooseClass – Componente per scegliere la classe
		16. CharacteristicsSelector – Componente per scegliere caratteristiche (bello, buono, etc.)
		- Gestione sistema card
		17. CardComponent: componente che mostra una carta nel raccoglitore
		18. Segnalibro nel raccoglitore
		- Stato Personaggio (Statistiche)
		19. CharacterStatsPanel – Pannello con tutte le carte del personaggio tipo raccoglitore di carte
		20. EnergyLifeSadnessBar – Barra energia e vita e tristezza (estende/usa CardComponent)
		21. SleepStatus - Mostra lo stato di addormentato (estende/usa CardComponent)
		22. ExperienceBar – esperienza  (usare tipo segnalibro nel raccoglitore)
		23. StatBadge – Badge per DES, INT, COS (estende/usa CardComponent per statistica)
		24. TraitList – Lista caratteristiche del personaggio (legale, buono, etc.) (estende/usa CardComponent per ogni caratteristica)
		25. EffectList – Lista effetti temporanei attivi sul personaggio e che mostra se in un personaggio è addormentato (estende/usa CardComponent per ogni effetto)
		26. ComaStatusBanner – Banner che indica se il personaggio è in coma (estende/usa CardComponent)
		- Inventario e Zaino tipo raccoglitore di carte
		27. InventoryPanel – Pannello inventario con cibo, magia, ricchezza, oggetti(estende/usa CardComponent)
		28. ConsumableList – Lista oggetti consumabili nello zaino(estende/usa CardComponent)
		29. WeightIndicator – Indicatore peso attuale/massimo (usare tipo segnalibro nel raccoglitore)
		30. UseItemButton – Bottone per usare un oggetto
		31. DropItemButton – Bottone per scartare un oggetto
		32. SendItemButton – Bottone per inviare un oggetto a un altro giocatore
		- Scambi (Trade) e in futuro altre cose del party
		33. ExchangePanel – Pannello per proporre/accettare scambi
		34. TradeProposalModal – Modale per proporre uno scambio
		35. TradeAcceptRejectButton – Bottoni per accettare/rifiutare scambio
		36. PendingTradesList – Lista scambi in attesa (usare tipo segnalibro nel raccoglitore)
		- Mappa e Luoghi
		37. MapView – Vista mappa con griglia di luoghi (stile tabellone)
		38. LocationCard – Card singola per un luogo (stile carta collezionabile)
		39. LocationGrid – Griglia 3D (sopra/sotto/cielo) per posizionare le carte luoghi
		40. LocationDetailModal – Modale con dettagli completi di un luogo
		41. MovementPanel – Pannello per mostrare luoghi vicini e possibilità di movimento
		42. FollowMovementDialog – Dialogo per accettare invito di movimento di gruppo (tipo carta che compare come modale!?)
		- Eventi e Scelte
		43. EventNotification – Notifica evento (toast/modale) sempre estende/usa CardComponent
		44. EventDescriptionPanel – estende/usa CardComponent con descrizione narrativa dell'evento
		45. ChoicesPanel – Componente tipo mini-raccoglitore che visualizza la lista delle opzioni
		46. ChoiceOption – Singola opzione estende/usa CardComponent se possibile e bottini per scegliere
		47. ChoiceTimeoutIndicator – Timer per scelta con countdown tipo clessidera
		- Registro e Missioni
		48. RegistryViewer – Visualizzazione registro annotazioni (come raccoglitore carte)
		49. RegistryCard – Carta singola per una chiave del registro (che estende/usa CardComponent)
		50. MissionLog – Elista con elenco missioni attive (stile pagine di un libro dove sono scritti gli eventi)
		51. MissionCard – Carta missione con titolo e descrizione (che estende/usa CardComponent)
		52. MissionStepCard – Carta singola per uno step di missione (che estende/usa CardComponent)
		- Turno e Azioni
		53. TurnOrderPanel – Pannello che mostra l'ordine dei turni (chi è il prossimo)  (che estende/usa CardComponent, i personaggi mostrati come mini-card)
		54. TurnTimer – Timer del turno come clessidera
		55. ActionPanel – Pannello con pulsanti per azioni disponibili (muovi, evento, oggetto, passa, dormi) , ogni azione è una che estende/usa CardComponent)
		56. PassButton – Bottone per passare il turno (card che estende/usa CardComponent)
		57. SleepButton – Bottone per addormentarsi volontariamente (card che estende/usa CardComponent)
		58. InteractEventButton – Bottone per interagire con un evento facoltativo (card che estende/usa CardComponent)
		- Meteo e Tempo
		59. WeatherIndicator – Indicatore meteo corrente con icona (card che estende/usa CardComponent)
		60. DailyEventsPanel – Pannello eventi giornalieri (inizio tempo) (card che estende/usa CardComponent)
		61. DayCounter – Contatore tempo/giorno corrente (card che estende/usa CardComponent)
		62. EndOfDayPanel – Pannello recap fine tempo (card che estende/usa CardComponent)
		- Chat e Comunicazioni
		63. ChatBox – Componente chat completo : questo lo vorrei come una lista di postit dove ogni personaggio scrive un postit, magari usare postit rettangolari e non quadrati
		64. ChatMessageList – Lista messaggi chat , lista di postit
		65. ChatInputBox – Input per inviare messaggi , singolo postit da inviare
		66. GameNotifications – Lista notifiche di sistema (tipo notifiche push) - postit o carta ?
		67. SystemMessageToast – Toast per messaggi di sistema (es. "Piove!") postiti oppure card
		- WebSocket parte1 (Separare logica WebSocket in un custom hook)
		68. WebSocketStatusIndicator – Indicatore connessione WebSocket (online/offline) in alto a destra
		69. ReconnectingBanner – Banner che avvisa che il giocatore si sta riconnettendo (card che estende/usa CardComponent) modale
		70. PlayerDisconnectedBadge – Badge che indica se un giocatore è disconnesso (icona sopra la card del personaggio nel party)
		- Log e Storia
		71. GameLogViewer – Visualizzatore cronologia eventi della partita (come raccoglitore di tante card)
		72. LogEventCard – Card singola per un evento nel log
		73. ActionHistoryPanel – Pannello con storico azioni del personaggio (lista card?
		- Admin e Debug
		74. AdminPanel – Pannello admin per gestione partite e parametri
		75. ReplayViewer – Visualizzatore replay partita
		76. SnapshotViewer – Visualizzatore snapshot partite
		77. RegistryEditorAdmin – Editor registro per admin
		78. ForceUnlockButton – Bottone admin per sbloccare partita
		79. KickPlayerButton – Bottone admin per espellere giocatore
		- Utilità e UI Generici
		80. LoadingSpinner – Spinner di caricamento (non usiamo la card)
		81. ErrorMessage – Messaggio di errore generico (card che estende/usa CardComponent)
		82. ConfirmModal – Modale di conferma generica (card che estende/usa CardComponent)
		83. TooltipWrapper – Wrapper per tooltip con FontAwesome
		84. CardFlipAnimation – Animazione flip carta (stile Pokemon/Magic)
		85. ProgressBar – Barra di progresso generica
		86. Clessidera - usato quando c'è un timeout! da mostrare in barra o in posizione da definire!
		- Componenti Specifici per "Raccoglitore Carte"
		87. CardCollection – Componente raccoglitore carte (visualizzazione griglia)
		88. CardPage – Pagina singola del raccoglitore
		89. FlipCard – Carta con fronte/retro (flip al click)
		90. CardGalleryModal – Modale per visualizzare carta ingrandita
		- Componenti di Layout
		91. AppLayout – Layout principale app
		92. Header – Header con logo e menu
		93. Footer – Footer con info
		94. Sidebar – Sidebar con menu navigazione
		95. ModalContainer – Contenitore generico per modali
		- WebSocket parte2 (Separare logica WebSocket in un custom hook)
		96. Inizializza e gestisce la connessione WebSocket
		97. WebSocketMessageDispatcher Parsing e dispatch messaggi WebSocket
		98. WebSocketMessageHandler Gestisce logica di sincronizzazione automatica
		99. WebSocketHeartbeat Mantiene viva la connessione con PING/PONG
		100. WebSocketReconnectModal Modale di riconnessione in caso di disconnessione
		101. WebSocketMessageQueue Coda messaggi per gestire disconnessioni temporanee
- Ora pensa che vorrei iniziare a svilupparlo, dammi 30 passi da fare, solo l'elenco dove la prima è "Creare il repository", per ogni punto dammi 5 sottopunti
	0.	Iniziare a scrivere questa analisi
		-	voglio creare un gioco che si chiamaerà AlNaoPathsGame, di do queste regole dammi 
		-	dato questo gioco, senza mettere in dubbio le regole di gioco elencami le API e il WebSocket che servono, senza codice
		-	dato questo gioco, senza mettere in dubbio le regole di gioco elencami i service che mi servono, senza codice
		-	dato questo gioco, senza mettere in dubbio le regole di gioco, voglio iniziare a pensare alla parte grafica del frontend-web, dammi la lista dei component che faresti, dammi solo elenco senza pensare al codice
	1.	Creare il repository
		-	Scegliere piattaforma (GitHub / GitLab / self-hosted)
		-	Definire nome definitivo del progetto
		-	Inizializzare repository vuoto
		-	Impostare branch principale
		-	Definire regole base di accesso
	2.	Definire lo scope della V1
		-	Elencare feature obbligatorie
		-	Elencare feature escluse
		-	Definire limite massimo di complessità
		-	Stabilire cosa rende la V1 “finita”
		-	Congelare decisioni fino a V2
	3.	Scegliere stack tecnologico definitivo
		-	Selezionare linguaggio backend
		-	Selezionare framework backend
		-	Selezionare database principale
		-	Selezionare tecnologia frontend
		-	Selezionare sistema di deploy
	4.	Definire struttura dei moduli backend
		-	Separare dominio da infrastruttura
		-	Definire modulo API
		-	Definire modulo realtime
		-	Definire modulo persistenza
		-	Definire modulo servizi condivisi
	5.	Impostare ambienti (dev / test / prod)
		-	Definire configurazioni per ambiente
		-	Separare credenziali e segreti
		-	Definire variabili d’ambiente
		-	Stabilire strategia di migrazione DB
		-	Definire processi di deploy
	6. Configurare CI minima (build + test vuoti)
		-	Scegliere sistema CI
		-	Definire pipeline di build
		-	Eseguire test automatici placeholder
		-	Fallire la pipeline su errori
		-	Collegare CI al branch principale
	7. Definire convenzioni di naming (API, DB, eventi)
		-	Definire naming endpoint REST
		-	Definire naming eventi WebSocket
		-	Definire naming tabelle e colonne
		-	Definire naming DTO e payload
		-	Documentare le convenzioni
	8. Disegnare il modello dati core
		-	Identificare entità principali
		-	Definire relazioni tra entità
		-	Identificare dati persistenti vs temporanei
		-	Definire cardinalità e dipendenze
		-	Validare il modello con casi reali
	9. Definire invarianti di sistema
		-	Elencare stati validi della partita
		-	Definire regole che non devono mai rompersi
		-	Identificare punti critici di concorrenza
		-	Definire condizioni di errore irreversibile
		-	Documentare assunzioni di base
	10. Creare schema DB iniziale
		-	Tradurre il modello dati in tabelle
		-	Definire chiavi primarie
		-	Definire chiavi esterne
		-	Definire indici iniziali
		-	Versionare lo schema
	11. Definire versioning delle API
		-	Stabilire schema di versionamento
		-	Decidere policy di backward compatibility
		-	Definire strategia di deprecazione
		-	Documentare versioni supportate
		-	Preparare struttura per versioni future
	12. Implementare autenticazione base
		-	Definire metodo di autenticazione
		-	Gestire registrazione utente
		-	Gestire login
		-	Gestire validazione sessione/token
		-	Gestire logout e scadenza
	13. Implementare creazione e join partita
		-	Creare endpoint di creazione partita
		-	Gestire codice/invito partita
		-	Gestire join dei giocatori
		-	Validare stato partita al join
		-	Notificare i client collegati
	14. Implementare stato partita minimale
		-	Definire stato iniziale partita
		-	Gestire transizioni di stato
		-	Esporre stato via API
		-	Sincronizzare stato via WebSocket
		-	Validare coerenza stato
	15. Implementare ciclo di turno base
		-	Definire ordine dei turni
		-	Gestire turno attivo
		-	Bloccare azioni fuori turno
		-	Gestire passaggio turno
		-	Notificare cambio turno
	16. Implementare gestione del tempo e timeout
		-	Definire durata del turno
		-	Avviare timer per turno
		-	Gestire scadenza automatica
		-	Applicare azione di default
		-	Notificare timeout ai client
	17. Implementare WebSocket e sync stato
		-	Definire canali WebSocket
		-	Gestire connessione e disconnessione
		-	Autenticare connessioni WS
		-	Inviare aggiornamenti di stato
		-	Gestire errori di trasmissione
	18. Gestire reconnect e desync client
		-	Rilevare disconnessioni
		-	Consentire reconnect sicuro
		-	Inviare stato completo al reconnect
		-	Risolvere conflitti di stato
		-	Loggare eventi di desync
	19. Implementare registro partita
		-	Definire struttura del registro
		-	Gestire scrittura eventi nel registro
		-	Esporre registro ai sistemi interni
		-	Sincronizzare cambi registro
		-	Validare consistenza registro
	20. Implementare eventi automatici minimi
		-	Definire trigger evento
		-	Attivare evento su condizione
		-	Applicare effetti dell’evento
		-	Aggiornare stato partita
		-	Notificare i giocatori
	21. Implementare scelte e risoluzione
		-	Definire struttura delle scelte
		-	Validare disponibilità scelta
		-	Gestire selezione scelta
		-	Risolvere effetti della scelta
		-	Notificare esito ai giocatori
	22. Implementare movimento e luoghi base
		-	Definire struttura dei luoghi
		-	Definire adiacenze
		-	Validare movimento consentito
		-	Applicare costo movimento
		-	Gestire eventi su entrata
	23. Implementare frontend minimale giocabile
		-	Implementare login UI
		-	Implementare lobby partita
		-	Visualizzare stato turno
		-	Visualizzare eventi e scelte
		-	Gestire input giocatore
	24. Gestire errori e stati limite
		-	Gestire azioni duplicate
		-	Gestire azioni fuori tempo
		-	Gestire partite bloccate
		-	Gestire dati inconsistenti
		-	Mostrare errori chiari al client
	25. Implementare logging e audit
		-	Loggare azioni giocatori
		-	Loggare eventi di sistema
		-	Loggare errori applicativi
		-	Collegare log a partita
		-	Conservare log critici
	26. Implementare snapshot partita
		-	Definire formato snapshot
		-	Creare snapshot manuale
		-	Creare snapshot automatico
		-	Ripristinare da snapshot
		-	Validare integrità ripristino
	27. Implementare strumenti admin minimi
		-	Visualizzare stato partite
		-	Forzare avanzamento turno
		-	Terminare partite bloccate
		-	Ripristinare snapshot
		-	Gestire utenti problematici
	28. Scrivere una storia di test completa
		-	Definire trama minimale
		-	Definire luoghi iniziali
		-	Definire eventi principali
		-	Definire scelte chiave
		-	Verificare completabilità
	29. Eseguire playtest tecnico end-to-end
		-	Test creazione partita
		-	Test flusso turni
		-	Test disconnessioni
		-	Test timeout
		-	Test fine partita
	30. verificare se manca qualcosa
	99. Congelare la V1 e documentare
		-	Bloccare nuove feature
		-	Stabilizzare API
		-	Scrivere documentazione tecnica
		-	Scrivere documentazione operativa
		-	Preparare roadmap V2



# Version Control
- First version created with AI prompt:
    > I want to create a game called AlNaoPathsGame; given these rules, provide them to me.
    > Given this game, without questioning the listed game rules, list the APIs and the WebSocket topics needed (no code).
    > Given this game, without questioning the listed game rules, list the services required (no code).
    > Given this game, without questioning the listed game rules, I want to start thinking about the frontend-web graphics; give me the list of components you would create, only the list and no code.
- **Document Version**: 1.1
	- 1.0: fist version of file in italian language (February 3, 2026)
	- 1.1: added licence and version control sections (February 5, 2026)
- **Last Updated**: February 5, 2026
- **Status**: In progress, traslation *coming soon*



# < AlNao />
All source code and information in this repository are the result of careful and patient development work by AlNao, who has made every effort to verify their correctness to the greatest extent possible. If part of the code or any content has been taken from external sources, the original provenance is always cited, in respect of transparency and intellectual property.

Some content and portions of code in this repository were also produced with the support of artificial intelligence tools, whose contribution helped enrich and accelerate the creation of the material. Every piece of information and code fragment has nevertheless been carefully checked and validated with the goal of ensuring the highest quality and reliability of the provided content.

For further details, in-depth information, or requests for clarification, please visit AlNao.it.

## License
Made with ❤️ by <a href="https://www.alnao.it">AlNao</a>
&bull; 
Public projects 
<a href="https://www.gnu.org/licenses/gpl-3.0"  valign="middle"> <img src="https://img.shields.io/badge/License-GPL%20v3-blue?style=plastic" alt="GPL v3" valign="middle" /></a>
*Free Software!*

The software is distributed under the terms of the GNU General Public License v3.0. Use, modification, and redistribution are permitted, provided that any copy or derivative work is released under the same license. The content is provided "as is", without any warranty, express or implied.# Documentation - Step 1: Project creation

