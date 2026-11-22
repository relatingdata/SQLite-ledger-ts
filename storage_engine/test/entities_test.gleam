import entities.{EntityRow, NameTaken}
import gleam/option.{None, Some}
import gleeunit/should

pub fn create_with_free_name_is_ok_test() {
  let current = [EntityRow(1, "Cash", None, None)]

  entities.validate_write(current, 2, None, "Sales")
  |> should.equal(Ok(Nil))
}

pub fn create_with_taken_name_under_same_parent_is_rejected_test() {
  let current = [EntityRow(1, "Cash", None, None)]

  entities.validate_write(current, 2, None, "Cash")
  |> should.equal(Error(NameTaken))
}

pub fn same_name_is_fine_under_a_different_parent_test() {
  let current = [EntityRow(1, "Cash", Some(100), None)]

  entities.validate_write(current, 2, Some(200), "Cash")
  |> should.equal(Ok(Nil))
}

pub fn renaming_an_entity_to_its_own_current_name_never_collides_with_itself_test() {
  let current = [EntityRow(1, "Cash", None, None)]

  // id 1 renaming to "Cash" under the same parent is id 1 matching
  // its own current row — never a collision with itself.
  entities.validate_write(current, 1, None, "Cash")
  |> should.equal(Ok(Nil))
}

pub fn renaming_onto_a_different_entitys_live_name_is_rejected_test() {
  let current = [EntityRow(1, "Cash", None, None), EntityRow(2, "Sales", None, None)]

  // id 1 trying to rename itself to "Sales", which id 2 already holds.
  entities.validate_write(current, 1, None, "Sales")
  |> should.equal(Error(NameTaken))
}

pub fn two_translations_may_share_a_word_under_a_language_test() {
  // 2 Languages > 3 Italian > 4 "Attivo" (Asset); a second "Attivo" (Active).
  let current = [
    EntityRow(2, "Languages", Some(1), None),
    EntityRow(3, "Italian", Some(2), None),
    EntityRow(4, "Attivo", Some(3), Some(50)),
  ]

  entities.validate_write(current, 5, Some(3), "Attivo")
  |> should.equal(Ok(Nil))
}
