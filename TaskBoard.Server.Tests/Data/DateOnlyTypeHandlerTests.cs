using System.Data;
using NSubstitute;
using TaskBoard.Server.Data;

namespace TaskBoard.Server.Tests.Data
{
    public class DateOnlyTypeHandlerTests
    {
        private readonly DateOnlyTypeHandler _handler = new();

        [Fact]
        public void SetValue_WritesMidnightDateTime()
        {
            var parameter = Substitute.For<IDbDataParameter>();

            _handler.SetValue(parameter, new DateOnly(2026, 7, 9));

            Assert.Equal(new DateTime(2026, 7, 9, 0, 0, 0), parameter.Value);
        }

        [Fact]
        public void Parse_PassesThroughDateOnly()
        {
            var value = new DateOnly(2026, 7, 9);

            Assert.Equal(value, _handler.Parse(value));
        }

        [Fact]
        public void Parse_TruncatesDateTimeToDate()
        {
            var value = new DateTime(2026, 7, 9, 23, 59, 59);

            Assert.Equal(new DateOnly(2026, 7, 9), _handler.Parse(value));
        }

        [Fact]
        public void Parse_Throws_OnUnsupportedType()
        {
            Assert.Throws<InvalidCastException>(() => _handler.Parse("2026-07-09"));
        }
    }

    public class NullableDateOnlyTypeHandlerTests
    {
        private readonly NullableDateOnlyTypeHandler _handler = new();

        [Fact]
        public void SetValue_WritesMidnightDateTime()
        {
            var parameter = Substitute.For<IDbDataParameter>();

            _handler.SetValue(parameter, new DateOnly(2026, 7, 9));

            Assert.Equal(new DateTime(2026, 7, 9, 0, 0, 0), parameter.Value);
        }

        [Fact]
        public void SetValue_WritesDbNull_ForNull()
        {
            var parameter = Substitute.For<IDbDataParameter>();

            _handler.SetValue(parameter, null);

            Assert.Equal(DBNull.Value, parameter.Value);
        }

        [Fact]
        public void Parse_PassesThroughDateOnly()
        {
            var value = new DateOnly(2026, 7, 9);

            Assert.Equal(value, _handler.Parse(value));
        }

        [Fact]
        public void Parse_TruncatesDateTimeToDate()
        {
            var value = new DateTime(2026, 7, 9, 23, 59, 59);

            Assert.Equal(new DateOnly(2026, 7, 9), _handler.Parse(value));
        }

        [Fact]
        public void Parse_ReturnsNull_OnUnsupportedType()
        {
            Assert.Null(_handler.Parse("2026-07-09"));
        }
    }
}
