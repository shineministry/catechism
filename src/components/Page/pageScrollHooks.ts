import {
  LeanPageNode,
  LeanPageParagraph,
} from './../../makeStaticAssets/typedefs'
import { CCCRefElement } from '../../store/cccTypedefs'
import { createRef, useState, useEffect, useCallback } from 'react'
import queryString from 'query-string'

export interface RefsMap {
  [index: string]: WrapperRefMeta
}

export interface WrapperRefMeta {
  ref: React.RefObject<HTMLDivElement>
  highlighted: boolean
}

export const usePageScrollHooks = (
  page: LeanPageNode | undefined,
  locationSearch: string
): RefsMap => {
  const pageFilled = page || { id: '', paragraphs: [], footnotes: {} }
  const { paragraphs, footnotes } = pageFilled

  const paragraphKeys = paragraphs.map((_, index) => getParagraphRefKey(index))
  const footnoteKeys = Object.keys(footnotes).map(getFootnoteRefKey)
  const cccRefToParagraphMapper = createCCCRefToParagraphMapper(paragraphs)

  const [shouldUpdate, setShouldUpdate] = useState(false)
  const [lastFocusedElement, setLastFocusedElement] = useState('')
  const [focusedElement, setFocusedElement] = useState('')

  const makeUpdatedElementRefs = useCallback(
    () =>
      makeItemRefs(
        [...paragraphKeys, ...footnoteKeys],
        focusedElement,
        cccRefToParagraphMapper
      ),
    [paragraphKeys, footnoteKeys, cccRefToParagraphMapper, focusedElement]
  )

  const [elementRefs, setElementRefs] = useState(makeUpdatedElementRefs())

  useEffect(() => {
    if (shouldUpdate) {
      return
    }

    const newFocusedElement = getCurrentFocusedElement(locationSearch)
    if (lastFocusedElement !== newFocusedElement) {
      setShouldUpdate(true)
      setFocusedElement(newFocusedElement)
    }
  }, [shouldUpdate, locationSearch, lastFocusedElement, setShouldUpdate])

  useEffect(() => {
    if (!shouldUpdate) {
      return
    }
    setShouldUpdate(false)
    setLastFocusedElement(focusedElement)

    const resolvedElementKey = resolveFocusedElementKey(
      cccRefToParagraphMapper,
      focusedElement
    )
    const focusedElementMeta = elementRefs[resolvedElementKey]
    if (!focusedElementMeta) {
      setFocusedElement('')
      return
    }

    setElementRefs(makeUpdatedElementRefs())
    scrollToElement(focusedElementMeta)

    setImmediate(() => {
      setElementRefs(makeResettedElementRefs(elementRefs, resolvedElementKey))
      setFocusedElement('')
    })
  }, [
    makeUpdatedElementRefs,
    cccRefToParagraphMapper,
    elementRefs,
    focusedElement,
    shouldUpdate,
    footnoteKeys,
    paragraphKeys,
  ])

  return elementRefs
}

const makeItemRefs = (
  keys: string[],
  focusedElementKey: string,
  cccRefToParagraphMapper: CCCRefToParagraphMapper
): RefsMap => {
  const resolvedKey = resolveFocusedElementKey(
    cccRefToParagraphMapper,
    focusedElementKey
  )
  return keys.reduce(
    (acc, currentKey) => ({
      ...acc,
      [currentKey]: {
        ref: createRef(),
        highlighted: currentKey === resolvedKey,
      },
    }),
    {}
  )
}

const makeResettedElementRefs = (
  elementRefs: RefsMap,
  keyToReset: string
): RefsMap => {
  const updatedElementRef: WrapperRefMeta = {
    ...elementRefs[keyToReset],
    highlighted: false,
  }
  return { ...elementRefs, [keyToReset]: updatedElementRef }
}

interface CCCRefToParagraphMapper {
  [cccRef: string]: string
}

const createCCCRefToParagraphMapper = (
  paragraphs: LeanPageParagraph[]
): CCCRefToParagraphMapper =>
  paragraphs.reduce((acc, curr, index) => {
    const cccRefs = curr.elements.filter(e => e.type === 'ref-ccc')
    if (cccRefs.length === 0) {
      return acc
    }

    const cccRef = cccRefs[0] as CCCRefElement
    return {
      ...acc,
      [getCCCRefKey(cccRef.ref_number)]: getParagraphRefKey(index),
    }
  }, {})

export const getParagraphRefKey = (index: number) => `paragraph-${index + 1}`

export const getFootnoteRefKey = (footnoteNumber: string) =>
  `footnote-${footnoteNumber}`

export const getCCCRefKey = (refNumber: number) => `ccc-${refNumber}`

const resolveFocusedElementKey = (
  cccRefToParagraphMapper: CCCRefToParagraphMapper,
  currentFocusedElement: string
): string => {
  return currentFocusedElement in cccRefToParagraphMapper
    ? cccRefToParagraphMapper[currentFocusedElement]
    : currentFocusedElement
}

const getCurrentFocusedElement = (locationSearch: string): string => {
  const params = queryString.parse(locationSearch)

  const focusedElement = (params['focus'] as string) || ''
  return focusedElement
}

const scrollToElement = (elementMeta: WrapperRefMeta) => {
  const current = elementMeta.ref.current as HTMLDivElement
  window.scrollTo(0, current.offsetTop - SCROLL_TO_ELEMENT_OFFSET)
}

const SCROLL_TO_ELEMENT_OFFSET = 100
