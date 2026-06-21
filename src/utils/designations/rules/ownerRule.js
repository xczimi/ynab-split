/**
 * Ownership rule: resolves who is responsible for a transaction.
 * Precedence: explicit #shared > explicit #<person> > category->owner map > shared.
 */

import { extractAllHashtags } from '../extractors/hashtags.js';
import { slugifyPersonName } from '../config.js';

/**
 * @param {Object} transaction
 * @param {Object} ownership
 * @param {{left:{name:string}, right:{name:string}}} ownership.personNames
 * @param {Object<string,string>} ownership.categoryOwners  categoryId -> 'left'|'right'
 * @returns {{ownerSide:'left'|'right'|'shared', reason:string}}
 */
export function detectOwner(transaction, ownership = {}) {
  const personNames = ownership.personNames || { left: { name: '' }, right: { name: '' } };
  const categoryOwners = ownership.categoryOwners || {};

  const leftSlug = slugifyPersonName(personNames.left?.name);
  const rightSlug = slugifyPersonName(personNames.right?.name);

  const tags = extractAllHashtags(transaction).map(t => t.toLowerCase());

  // 1. Explicit #shared wins outright.
  if (tags.includes('shared')) {
    return { ownerSide: 'shared', reason: 'explicit #shared' };
  }

  // 2. Explicit person hashtags (only when a non-empty, unambiguous slug exists).
  const hasLeft = !!leftSlug && tags.includes(leftSlug);
  const hasRight = !!rightSlug && rightSlug !== leftSlug && tags.includes(rightSlug);
  if (hasLeft && hasRight) {
    console.debug('ownerRule: conflicting owner tags, defaulting to shared', transaction.id);
    return { ownerSide: 'shared', reason: 'conflicting owner tags' };
  }
  if (hasLeft) return { ownerSide: 'left', reason: `#${leftSlug}` };
  if (hasRight) return { ownerSide: 'right', reason: `#${rightSlug}` };

  // 3. Category -> owner map.
  const catOwner = categoryOwners[transaction.category_id];
  if (catOwner === 'left' || catOwner === 'right') {
    return { ownerSide: catOwner, reason: 'category owner' };
  }

  // 4. Default.
  return { ownerSide: 'shared', reason: 'default' };
}
