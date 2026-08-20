ALTER TABLE `inventarios` MODIFY `estado` enum('em_curso','pendente_aprovacao','fechado') NOT NULL DEFAULT 'em_curso';
